$ErrorActionPreference = 'SilentlyContinue'

$sshArgs = @(
  '-N'
  '-T'
  '-o'
  'ServerAliveInterval=15'
  '-o'
  'ServerAliveCountMax=3'
  '-o'
  'ExitOnForwardFailure=yes'
  '-i'
  'C:\Users\USER\.ssh\caraxes_vps_access'
  '-L'
  '9944:127.0.0.1:9944'
  '-L'
  '8088:127.0.0.1:8088'
  '-L'
  '6300:127.0.0.1:6300'
  'root@49.51.134.79'
)

while ($true) {
  & ssh.exe @sshArgs
  Start-Sleep -Seconds 2
}
