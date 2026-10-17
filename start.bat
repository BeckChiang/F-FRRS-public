@echo off
echo Starting F-FRRS...
start "F-FRRS Server" /min cmd /c "python -m http.server 8080"
timeout /t 2 /nobreak >nul
start http://localhost:8080
