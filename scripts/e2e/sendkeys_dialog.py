import subprocess
import time

ps = r'''
$wshell = New-Object -ComObject wscript.shell
$activated = $wshell.AppActivate('选择扩展程序目录')
Start-Sleep -Milliseconds 400
if (-not $activated) {
    # fallback: activate by partial title
    $activated = $wshell.AppActivate('扩展程序目录')
    Start-Sleep -Milliseconds 400
}
Write-Output ("activated: " + $activated)
$wshell.SendKeys('D:\hermes\kankan-shoucang\browser-extension{ENTER}')
Start-Sleep -Milliseconds 1500
$wshell.SendKeys('{ENTER}')
Write-Output "sent"
'''
r = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', ps],
                   capture_output=True, text=True, timeout=60)
print(r.stdout.strip())
print(r.stderr.strip()[:200])
