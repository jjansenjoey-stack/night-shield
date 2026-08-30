@echo off
REM Dev-server launcher. Prepends the Node install dir to PATH so the server
REM starts even from a shell whose environment predates the Node install.
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
npm run dev
