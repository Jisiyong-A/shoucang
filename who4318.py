import subprocess

out = subprocess.run(
    ['powershell', '-NoProfile', '-Command',
     "Get-NetTCPConnection -LocalPort 4318 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique | ForEach-Object { $p = Get-Process -Id $_ -ErrorAction SilentlyContinue; Write-Output \"PID=$($p.Id) NAME=$($p.ProcessName) START=$($p.StartTime)\" }"],
    capture_output=True, text=True, timeout=30)
print(out.stdout.strip() or 'no listener')
