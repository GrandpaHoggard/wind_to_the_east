@echo off
if exist "%~dp0.tools\node\npm.cmd" (
    set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
    "%~dp0.tools\node\npm.cmd" run dev -- --host
) else (
    npm.cmd run dev -- --host
)
