@echo off
setlocal
cd /d "%~dp0"

echo Iniciando LeadFlow em ambiente Docker de homologacao...
echo Firebase esperado: leadflowtest-d32c2
echo Endereco: http://localhost:5175/
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker ainda nao esta disponivel neste terminal.
  echo Abra o Docker Desktop e reinicie o Windows caso a instalacao tenha acabado de terminar.
  echo.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo O Docker Desktop esta instalado, mas ainda nao esta em execucao.
  echo Abra o Docker Desktop, aguarde ficar pronto e tente novamente.
  echo.
  pause
  exit /b 1
)

docker compose up --build
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar a homologacao com Docker.
  pause
  exit /b 1
)

endlocal

