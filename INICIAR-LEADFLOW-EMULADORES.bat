@echo off
setlocal
cd /d "%~dp0"

echo Iniciando LeadFlow em ambiente local descartavel...
echo Aplicacao: http://localhost:5176/
echo Firebase Emulator UI: http://localhost:4000/
echo.

set "DOCKER_DIR=%LocalAppData%\Programs\DockerDesktop\resources\bin"
set "DOCKER_EXE=%DOCKER_DIR%\docker.exe"
if not exist "%DOCKER_EXE%" (
  set "DOCKER_EXE=docker"
  where docker >nul 2>nul
  if errorlevel 1 (
    echo Docker nao foi encontrado. Instale o Docker Desktop e tente novamente.
    pause
    exit /b 1
  )
 ) else (
  set "PATH=%DOCKER_DIR%;%PATH%"
)

"%DOCKER_EXE%" info >nul 2>nul
if errorlevel 1 (
  echo O Docker Desktop ainda nao esta pronto.
  echo Abra o Docker Desktop, aguarde a inicializacao e tente novamente.
  pause
  exit /b 1
)

echo Preparando os emuladores, os dados de teste e a aplicacao...
"%DOCKER_EXE%" compose --profile disposable up -d app-emulator
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar o ambiente descartavel.
  echo Consulte os detalhes com: docker compose --profile disposable logs
  pause
  exit /b 1
)

echo Aguardando o sistema ficar pronto...
for /L %%I in (1,1,60) do (
  curl.exe --silent --fail --max-time 2 "http://localhost:5176/" >nul 2>nul
  if not errorlevel 1 goto :ready
  ping 127.0.0.1 -n 3 >nul
)

echo.
echo O ambiente foi iniciado, mas o site nao respondeu dentro do tempo esperado.
echo Consulte os detalhes com: docker compose --profile disposable logs app-emulator
pause
exit /b 1

:ready
echo.
echo LeadFlow pronto. Abrindo o navegador...
start "" "http://localhost:5176/"
echo.
echo Esta janela pode ser fechada. Os containers continuarao executando.
ping 127.0.0.1 -n 4 >nul

endlocal
exit /b 0
