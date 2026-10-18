#Requires -RunAsAdministrator
param(
  [string]$VenvPython = "D:\Moongdaal\.venv\Scripts\python.exe",
  [string]$OllamaDir  = "$env:LOCALAPPDATA\Programs\Ollama",
  [string]$Model      = "gemma4:e2b",
  [int]$Port          = 8000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Backend     = Join-Path $ProjectRoot "backend"
$Prefix      = "PrivacyTriage-Block"

if (-not (Test-Path $VenvPython)) {
  throw "Python not found at $VenvPython. Run again with -VenvPython <full path to python.exe>"
}

# 1. Collect every program that touches private document data
$programs = New-Object System.Collections.Generic.List[string]
$programs.Add((Resolve-Path $VenvPython).Path)

# A Windows venv python.exe launches the real (base) python.exe, so block both
$basePrefix = (& $VenvPython -c "import sys; print(sys.base_prefix)").Trim()
$basePy = Join-Path $basePrefix "python.exe"
if (Test-Path $basePy) { $programs.Add($basePy) }

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) { $programs.Add($node.Source) }

$tess = if ($env:TESSERACT_CMD) { $env:TESSERACT_CMD } else { "C:\Program Files\Tesseract-OCR\tesseract.exe" }
if (Test-Path $tess) { $programs.Add($tess) }

if (Test-Path $OllamaDir) {
  Get-ChildItem $OllamaDir -Recurse -Filter *.exe | ForEach-Object { $programs.Add($_.FullName) }
} else {
  Write-Warning "Ollama folder not found at $OllamaDir. Pass -OllamaDir <folder> or Ollama will NOT be blocked."
}

# 2. Create the outbound BLOCK rules (remove old ones first)
Get-NetFirewallRule -DisplayName "$Prefix*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host "Creating firewall block rules:"
$i = 0
foreach ($p in ($programs | Select-Object -Unique)) {
  $i++
  New-NetFirewallRule -DisplayName "$Prefix-$i" `
    -Description "Private legal triage: block all outbound internet for this program. Loopback is not filtered." `
    -Direction Outbound -Action Block -Program $p -Profile Any | Out-Null
  Write-Host "  blocked outbound: $p"
}

# 3. Turn on logging of dropped (blocked) connections
Set-NetFirewallProfile -Profile Domain,Private,Public -LogBlocked True -LogAllowed False -LogMaxSizeKilobytes 16384
$logPath = [Environment]::ExpandEnvironmentVariables("%SystemRoot%\System32\LogFiles\Firewall\pfirewall.log")
Write-Host "Dropped-connection log: $logPath"

# 4. Disable telemetry in every library we know about (same process = inherited by the server)
$env:GEMMA_MODEL              = $Model
$env:HF_HUB_OFFLINE           = "1"
$env:TRANSFORMERS_OFFLINE     = "1"
$env:LANGCHAIN_TRACING_V2     = "false"
$env:LANGSMITH_TRACING        = "false"
$env:OTEL_SDK_DISABLED        = "true"
$env:DO_NOT_TRACK             = "1"
$env:NEXT_TELEMETRY_DISABLED  = "1"
$env:ANONYMIZED_TELEMETRY     = "false"

# 5. Start your teammate's backend, unchanged, bound to localhost only
Write-Host "`nStarting backend on 127.0.0.1:$Port (leave this window open; Ctrl+C to stop)"
Set-Location $Backend
& $VenvPython -m uvicorn main:app --host 127.0.0.1 --port $Port