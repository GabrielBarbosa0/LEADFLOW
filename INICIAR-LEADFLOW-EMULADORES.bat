@echo off
setlocal
cd /d "%~dp0"

echo Iniciando LeadFlow em ambiente local descartavel...
echo Aplicacao: http://localhost:5176/
echo Firebase Emulator UI: http://localhost:4000/
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker nao foi encontrado. Abra o Docker Desktop e tente novamente.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo O Docker Desktop ainda nao esta pronto.
  echo Abra o Docker Desktop, aguarde a inicializacao e tente novamente.
  pause
  exit /b 1
)

docker compose --profile disposable up --build app-emulator
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar o ambiente descartavel.
  pause
  exit /b 1
)

endlocal
