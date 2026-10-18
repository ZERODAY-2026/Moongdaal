$out = "D:\Moongdaal\PROJECT\evidence\connections.log"
"Monitor started $(Get-Date -Format o)" | Out-File $out
while ($true) {
  $ids = Get-Process | Where-Object { @("python","ollama","ollama app","node") -contains $_.ProcessName } | Select-Object -ExpandProperty Id
  $bad = Get-NetTCPConnection -ErrorAction SilentlyContinue |
    Where-Object { $ids -contains $_.OwningProcess -and $_.RemoteAddress -notin @("127.0.0.1","::1","0.0.0.0","::") }
  $t = Get-Date -Format "HH:mm:ss.fff"
  if ($bad) {
    $bad | ForEach-Object { "$t NON-LOCAL pid=$($_.OwningProcess) $($_.LocalAddress):$($_.LocalPort) -> $($_.RemoteAddress):$($_.RemotePort) $($_.State)" | Out-File $out -Append }
  } else {
    "$t ok: no non-local connections" | Out-File $out -Append
  }
  Start-Sleep -Milliseconds 500
}