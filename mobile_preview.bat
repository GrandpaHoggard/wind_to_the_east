@echo off
chcp 65001 >nul
title Wind to the East - Перегляд на телефоні (Wi-Fi)
echo ========================================================
echo   Wind to the East — Локальний сервер для смартфона
echo ========================================================
echo.
echo Переконайтеся, що комп'ютер і телефон підключені до одного Wi-Fi.
echo Після запуску знайдіть рядок "Network: http://192.168.x.x:5173/"
echo та введіть цю адресу в браузері на телефоні!
echo ========================================================
echo.

if exist "%~dp0.tools\node\npm.cmd" (
    set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
    "%~dp0.tools\node\npm.cmd" run dev -- --host
) else (
    npm.cmd run dev -- --host
)
pause
