@echo off
chcp 65001 >nul
title Збереження сайту на GitHub (Wind to the East)
echo ===================================================================
echo            ЗБЕРЕЖЕННЯ ПОТОЧНОЇ ВЕРСІЇ САЙТУ НА GITHUB
echo ===================================================================
echo.

set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
set "GCM_INTERACTIVE=always"

echo [1/3] Перевірка локальних змін...
git status --short

echo.
echo [2/3] Фіксація останніх змін (Commit)...
git add -A
git commit -m "feat: update forecast dashboard and site version" 2>nul
echo Локальні зміни зафіксовано.

echo.
echo [3/3] Відправка змін у репозиторій на GitHub...
echo Репозиторій: https://github.com/GrandpaHoggard/wind_to_the_east.git
echo.
echo (УВАГА: якщо з'явиться вікно входу GitHub у браузері, підтвердіть вхід)
echo.

git.exe push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ===================================================================
    echo  [УСПІХ!] Усі файли та поточну версію сайту збережено на GitHub!
    echo ===================================================================
    echo.
    echo Посилання на репозиторій з вашим кодом:
    echo   https://github.com/GrandpaHoggard/wind_to_the_east
    echo.
    echo Щоб сайт також відкривався в інтернеті через GitHub Pages:
    echo 1. Перейдіть: https://github.com/GrandpaHoggard/wind_to_the_east/settings/pages
    echo 2. У "Build and deployment" під "Source" виберіть: GitHub Actions
    echo 3. Зачекайте 1-2 хвилини - сайт опублікується за адресою:
    echo    https://grandpahoggard.github.io/wind_to_the_east/
    echo ===================================================================
) else (
    echo ===================================================================
    echo  [ПОМИЛКА ВІДПРАВКИ]
    echo ===================================================================
    echo Якщо сталася помилка доступу:
    echo 1. Переконайтеся, що ви увійшли під акаунтом GrandpaHoggard у браузері.
    echo 2. Також можна створити Personal Access Token на GitHub:
    echo    https://github.com/settings/tokens
    echo    з правами 'repo' і використати його як пароль.
    echo ===================================================================
)

echo.
pause
