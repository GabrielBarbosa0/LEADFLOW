@echo off
setlocal
cd /d "%~dp0"

echo Removendo os dados locais e recriando o ambiente descartavel...

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker nao foi encontrado.
  pause
  exit /b 1
)

docker compose --profile disposable stop app-emulator emulators
docker compose --profile disposable rm -f app-emulator emulators
docker compose --profile disposable up --build app-emulator
if errorlevel 1 (
  echo.
  echo Nao foi possivel recriar o ambiente descartavel.
  pause
  exit /b 1
)

endlocal
