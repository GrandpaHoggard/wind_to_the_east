@echo off
chcp 65001 >nul
if exist "%~dp0.tools\git\cmd\git.exe" (
    set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
)
set "GCM_INTERACTIVE=always"
echo Відправка коду на GitHub (зараз може відкритися вікно входу GitHub)...
git.exe push -u origin main
echo.
pause
