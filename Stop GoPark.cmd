@echo off
setlocal
cd /d "%~dp0"
call "%~dp0scripts\node-path.cmd"
if errorlevel 1 exit /b 1
node scripts\launch-local.mjs --stop
