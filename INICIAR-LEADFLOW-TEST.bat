@echo off
setlocal

title LeadFlow - Homologacao
cd /d "%~dp0"

if not exist ".env.staging.local" (
  echo.
  echo ERRO: o arquivo .env.staging.local nao foi encontrado.
  echo A homologacao nao sera iniciada para evitar o uso do Firebase errado.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERRO: Node.js e npm nao foram encontrados no PATH.
  echo.
  pause
  exit /b 1
)

curl.exe -fsS http://localhost:5176/ 2>nul | findstr /C:"<title>LeadFlow Test</title>" >nul
if not errorlevel 1 (
  echo.
  echo A homologacao ja esta em execucao.
  echo Abrindo http://localhost:5176/
  start "" http://localhost:5176/
  exit /b 0
)

netstat -ano | findstr /R /C:":5176 .*LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo ERRO: a porta 5176 esta sendo usada por outro programa.
  echo Feche o programa que ocupa a porta e tente novamente.
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando LeadFlow em modo de homologacao...
echo Firebase esperado: leadflowtest-d32c2
echo Endereco: http://localhost:5176/
echo.

call npm.cmd run dev -- --mode staging --host localhost --port 5176 --strictPort --open

if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar a homologacao.
  echo Verifique se a porta 5176 ja esta sendo usada.
  echo.
  pause
)

endlocal
