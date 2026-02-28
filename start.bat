@echo off
echo Starting Claude Bridge Gateway...
echo.

:: Start tunnel keep-alive in a separate window
echo [1/2] Starting dev tunnel (keep-alive)...
start "Claude Bridge Tunnel" cmd /c tunnel-keep-alive.bat

:: Wait for tunnel to connect
timeout /t 8 /nobreak > nul

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
