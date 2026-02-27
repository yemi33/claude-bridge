@echo off
echo Starting Claude Bridge Gateway...
echo.

:: Start dev tunnel in background
echo [1/2] Starting dev tunnel...
start /B devtunnel host claude-bridge > tunnel.log 2>&1

:: Wait for tunnel to connect
timeout /t 5 /nobreak > nul

:: Start the server
echo [2/2] Starting server...
echo.
echo   Dashboard: http://localhost:3981/dashboard
echo   Devtools:  http://localhost:3979/devtools
echo.
echo Press Ctrl+C to stop.
echo.

set CLAUDECODE=
npx tsx -r dotenv/config src/index.ts
