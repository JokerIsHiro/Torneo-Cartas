$phoneIp = "192.168.1.134"
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$scrcpy = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.0\scrcpy.exe"

if (-not (Test-Path $adb)) {
  Write-Host "No se encontro adb en: $adb"
  Read-Host "Pulsa Enter para salir"
  exit 1
}

if (-not (Test-Path $scrcpy)) {
  Write-Host "No se encontro scrcpy en: $scrcpy"
  Read-Host "Pulsa Enter para salir"
  exit 1
}

Write-Host "Buscando puerto ADB inalambrico para $phoneIp..."
$connectedDevice = (& $adb devices -l) |
  Select-String "^\S.*\s+device\s+" |
  ForEach-Object {
    if ($_.Line -match "^(.*?)\s+device\s+") {
      $matches[1].Trim()
    }
  } |
  Select-Object -First 1

if ($connectedDevice) {
  Write-Host "Movil ya conectado como $connectedDevice"
  Write-Host "Lanzando scrcpy..."
  & $scrcpy -s $connectedDevice --stay-awake --mouse=sdk --keyboard=sdk --window-title AetherHub-Control
  exit $LASTEXITCODE
}

$services = & $adb mdns services
$devices = $services |
  Select-String "_adb-tls-connect._tcp\s+$([regex]::Escape($phoneIp)):\d+" |
  ForEach-Object {
    if ($_.Line -match "($([regex]::Escape($phoneIp)):\d+)") {
      $matches[1]
    }
  }

if (-not $devices) {
  Write-Host "No se encontro el movil por mDNS."
  Write-Host 'Comprueba que "Depuracion inalambrica" esta activa y que PC y movil estan en la misma WiFi.'
  Read-Host "Pulsa Enter para salir"
  exit 1
}

$device = $null
foreach ($candidate in $devices) {
  Write-Host "Probando $candidate..."
  $connectResult = & $adb connect $candidate
  Write-Host $connectResult
  if ($connectResult -match "connected to|already connected") {
    $device = $candidate
    break
  }
}

if (-not $device) {
  Write-Host "Ningun puerto anunciado por mDNS acepto la conexion."
  Read-Host "Pulsa Enter para salir"
  exit 1
}

Write-Host "Lanzando scrcpy..."
& $scrcpy -s $device --stay-awake --mouse=sdk --keyboard=sdk --window-title AetherHub-Control
