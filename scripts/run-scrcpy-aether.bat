@echo off
setlocal

set "PHONE_IP=192.168.1.134"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "SCRCPY=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.0\scrcpy.exe"

if not exist "%ADB%" (
  echo No se encontro adb en:
  echo %ADB%
  pause
  exit /b 1
)

if not exist "%SCRCPY%" (
  echo No se encontro scrcpy en:
  echo %SCRCPY%
  pause
  exit /b 1
)

echo Buscando puerto ADB inalambrico para %PHONE_IP%...

for /f "tokens=*" %%i in ('"%ADB%" mdns services ^| findstr "%PHONE_IP%" ^| findstr "_adb-tls-connect"') do (
  for %%a in (%%i) do set "LAST_TOKEN=%%a"
)

if "%LAST_TOKEN%" == "" (
  echo No se encontro el movil por mDNS.
  echo Comprueba que "Depuracion inalambrica" esta activa y que PC y movil estan en la misma WiFi.
  pause
  exit /b 1
)

set "DEVICE=%LAST_TOKEN%"
echo Conectando a %DEVICE%...
"%ADB%" connect %DEVICE%
"%SCRCPY%" -s %DEVICE% --stay-awake --mouse=sdk --keyboard=sdk --window-title AetherHub-Control

endlocal
