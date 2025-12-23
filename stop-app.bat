@echo off
REM ========================================
REM Скрипт остановки приложения Complaints App
REM ========================================

echo [%date% %time%] Начало остановки приложения... >> "%~dp0logs\restart.log"

REM Остановка процессов Node.js (backend и frontend)
echo Остановка процессов Node.js...

REM Убиваем процессы по портам, если они заняты
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :3000') DO (
    echo Останавливаем процесс на порту 3000 (PID: %%P)
    taskkill /F /PID %%P >nul 2>&1
)

FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :3002') DO (
    echo Останавливаем процесс на порту 3002 (PID: %%P)
    taskkill /F /PID %%P >nul 2>&1
)

REM Дополнительно убиваем все процессы node.exe, которые могут быть связаны с приложением
wmic process where "name='node.exe' and commandline like '%%complaints-app%%'" delete >nul 2>&1

echo [%date% %time%] Приложение остановлено успешно >> "%~dp0logs\restart.log"
echo Приложение остановлено
timeout /t 5 /nobreak >nul
