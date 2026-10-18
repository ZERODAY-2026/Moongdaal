#Requires -RunAsAdministrator
param(
  [string]$VenvPython = "D:\Moongdaal\.venv\Scripts\python.exe",
  [string]$Sample     = "",
  [string]$Api        = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Sample) { $Sample = Join-Path $ProjectRoot "samples\rental_sample.txt" }
$Evidence = Join-Path $ProjectRoot "evidence"
$FwLog = [Environment]::ExpandEnvironmentVariables("%SystemRoot%\System32\LogFiles\Firewall\pfirewall.log")

function Read-FwLog {
  if (-not (Test-Path $FwLog)) { return @() }
  $fs = [System.IO.File]::Open($FwLog, 'Open', 'Read', 'ReadWrite')
  $sr = New-Object System.IO.StreamReader($fs)
  $text = $sr.ReadToEnd(); $sr.Close(); $fs.Close()
  return @($text -split "`r?`n" | Where-Object { $_ -ne "" })
}

# Outbound drops only (path column = SEND), after line number $skip
function Get-SendDrops($lines, $skip) {
  if ($skip -gt $lines.Count) { $skip = 0 }
  @($lines | Select-Object -Skip $skip |
    Where-Object { $_ -match '^\d{4}-\d{2}-\d{2} ' -and $_ -match ' DROP ' -and $_ -match ' SEND\s*$' })
}

# --- Pre-checks ---
$rules = @(Get-NetFirewallRule -DisplayName "PrivacyTriage-Block*" -ErrorAction SilentlyContinue)
if ($rules.Count -eq 0) { throw "No block rules found. Run launch_private.ps1 first." }
try { Invoke-RestMethod "$Api/openapi.json" | Out-Null }
catch { throw "Backend not reachable at $Api. Is launch_private.ps1 running in the other window?" }
if (-not (Test-Path $Sample)) { throw "Sample file not found: $Sample" }

# --- STEP 1: positive control (must be logged, otherwise the method is unproven) ---
Write-Host "STEP 1: positive control (blocked Python tries to reach 1.1.1.1)..."
$before = (Read-FwLog).Count
& $VenvPython (Join-Path $PSScriptRoot "egress_probe.py")
Start-Sleep -Seconds 7   # the firewall log is written with a short delay
$control = Get-SendDrops (Read-FwLog) $before
Write-Host "  control drops logged: $($control.Count)"

# --- STEP 2: real workflow ---
Write-Host "`nSTEP 2: full workflow (analyze + 3 questions). This can take a few minutes..."
$base  = (Read-FwLog).Count
$start = Get-Date

$raw = curl.exe -s --max-time 900 -F "file=@$Sample" "$Api/analyze"
$analyze = ($raw -join "`n") | ConvertFrom-Json
$itemCount = @($analyze.items).Count
Write-Host "  /analyze returned $itemCount items"

function Ask($q) {
  $body = (@{ question = $q } | ConvertTo-Json -Compress)
  $r = $body | curl.exe -s --max-time 600 -X POST -H "Content-Type: application/json" --data-binary "@-" "$Api/ask"
  ($r -join "`n") | ConvertFrom-Json
}
$questions = @("How much is the deposit?", "Are pets allowed?", "Is this agreement enforceable?")
$statuses = @()
foreach ($q in $questions) {
  $a = Ask $q
  $statuses += "  '$q' -> status: $($a.status)"
  Write-Host $statuses[-1]
}

$end = Get-Date
Start-Sleep -Seconds 7
$drops = Get-SendDrops (Read-FwLog) $base
Write-Host "`n  blocked outbound attempts during workflow: $($drops.Count)"

# --- Verdict ---
if ($control.Count -eq 0)      { $verdict = "INCONCLUSIVE: the control probe was not logged (is the internet ON, and Windows Firewall ON?)" }
elseif ($itemCount -eq 0)      { $verdict = "INCONCLUSIVE: /analyze returned no items, so the workflow did not really run" }
elseif ($drops.Count -eq 0)    { $verdict = "PASS: 0 outbound attempts from blocked programs; control proved the log detects attempts" }
else                           { $verdict = "FAIL: $($drops.Count) outbound attempts were blocked, see firewall_drops_run.log" }

# --- Save evidence (contains IPs/ports/times only, never document text) ---
$control | Out-File (Join-Path $Evidence "firewall_control.log") -Encoding ascii
$drops   | Out-File (Join-Path $Evidence "firewall_drops_run.log") -Encoding ascii

$report = @()
$report += "Privacy verification report"
$report += "Run window: $($start.ToString('o')) to $($end.ToString('o'))"
$report += "Sample file: $(Split-Path $Sample -Leaf)"
$report += "OS: $((Get-CimInstance Win32_OperatingSystem).Caption) $((Get-CimInstance Win32_OperatingSystem).Version)"
$report += ""
$report += "Programs blocked (outbound):"
$report += (Get-NetFirewallApplicationFilter | Where-Object { $_.InstanceID -like "PrivacyTriage-Block*" } | ForEach-Object { "  " + $_.Program })
$report += ""
$report += "Control probe drops logged: $($control.Count)"
$report += "Workflow drops logged:      $($drops.Count)"
$report += "/analyze items returned:    $itemCount"
$report += $statuses
$report += ""
$report += "VERDICT: $verdict"
$report | Out-File (Join-Path $Evidence "privacy_verification_report.txt") -Encoding ascii

Write-Host "`n$verdict"
Write-Host "Evidence saved in: $Evidence"