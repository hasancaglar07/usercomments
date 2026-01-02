@echo off
setlocal

pushd "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [setup] Creating virtual environment...
  py -3 -m venv .venv
)

call ".venv\Scripts\activate.bat"

echo [setup] Installing requirements...
python -m pip install -r requirements.txt
if errorlevel 1 goto :error

if not exist ".env" (
  echo [error] .env not found. Copy .env.example to .env and fill required values.
  goto :end
)

:: Proxy Configuration
:: Provider: Livaproxy
:: Host: rotating.livaproxy.com, Port: 1080
set HTTP_PROXY=http://uyDM6Wxe-country-mix-city-mix-residential:YVmInyco@rotating.livaproxy.com:1080
set HTTPS_PROXY=http://uyDM6Wxe-country-mix-city-mix-residential:YVmInyco@rotating.livaproxy.com:1080
echo Proxy set to rotating.livaproxy.com:1080

set MODE=loop
set DRYRUN=0

:: Force settings to ensure natural behavior
set MAX_NEW_REVIEWS_PER_LOOP=1
set DAILY_REVIEW_LIMIT=1000
set LOOP_MIN_SECONDS=300
set LOOP_MAX_SECONDS=900

if /I "%MODE%"=="once" (
  if "%DRYRUN%"=="1" (
    python -m ingestor.main --once --dry-run
  ) else (
    python -m ingestor.main --once
  )
) else (
  if "%DRYRUN%"=="1" (
    python -m ingestor.main --dry-run
  ) else (
    python -m ingestor.main
  )
)

goto :end

:error
echo [error] Dependency install failed.

:end
popd
endlocal
pause
