#Requires -RunAsAdministrator
Get-NetFirewallRule -DisplayName "PrivacyTriage-Block*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Set-NetFirewallProfile -Profile Domain,Private,Public -LogBlocked False
Write-Host "Removed block rules and turned dropped-connection logging off."