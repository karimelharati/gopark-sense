@echo off
setlocal
cd /d "%~dp0"
call "%~dp0scripts\node-path.cmd"
if errorlevel 1 goto failed
node scripts\launch-phone-test.mjs %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo Run SETUP.cmd first. Read the error above for details.
pause
exit /b 1
