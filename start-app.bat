@echo off
REM ========================================
REM Скрипт запуска приложения Complaints App
REM ========================================

echo [%date% %time%] Начало запуска приложения... >> "%~dp0logs\restart.log"

REM Переход в директорию приложения
cd /d "%~dp0"

REM Запуск Backend (в фоновом режиме)
echo Запуск Backend сервера...
start "Complaints Backend" /MIN cmd /c "cd /d "%~dp0backend" && npm run dev >> "%~dp0logs\backend.log" 2>&1"

REM Ждем 10 секунд для инициализации backend
echo Ожидание инициализации Backend (10 сек)...
timeout /t 10 /nobreak >nul

REM Запуск Frontend (в фоновом режиме)
echo Запуск Frontend сервера...
start "Complaints Frontend" /MIN cmd /c "cd /d "%~dp0frontend" && npm start >> "%~dp0logs\frontend.log" 2>&1"

echo [%date% %time%] Приложение запущено успешно >> "%~dp0logs\restart.log"
echo Приложение запущено
echo Backend: http://localhost:3002
echo Frontend: http://localhost:3000

timeout /t 3 /nobreak >nul
