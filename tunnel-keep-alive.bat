@echo off
echo [Tunnel Keep-Alive] Starting...
echo.

:loop
echo [%date% %time%] Logging in to dev tunnels...
devtunnel user login -e -w >nul 2>&1

echo [%date% %time%] Starting tunnel...
devtunnel host claude-bridge

echo [%date% %time%] Tunnel disconnected. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
