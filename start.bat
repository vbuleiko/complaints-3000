@echo off
echo ====================================
echo   Система управления жалобами
echo   "Резолюции"
echo ====================================
echo.

echo Установка зависимостей...
npm run install:all

echo.
echo Запуск приложения...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo.

npm run dev