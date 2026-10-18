@echo off
echo Starting F-FRRS...
netstat -ano | findstr ":8080" | findstr /R "LISTENING" >nul
if %errorlevel%==0 (
  echo Port 8080 is already in use, reusing the existing server...
) else (
  start "F-FRRS Server" /min cmd /c "python serve.py 8080"
  timeout /t 2 /nobreak >nul
)
start http://localhost:8080
