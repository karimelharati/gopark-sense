@echo off
setlocal
cd /d "%~dp0"
call "%~dp0scripts\node-path.cmd"
if errorlevel 1 goto failed
call npm.cmd run setup
if errorlevel 1 goto failed
echo.
echo Ready. Open GoPark.cmd launches the app.
echo Open GoPark Two Phones.cmd launches phone pairing.
pause
exit /b 0
:failed
echo.
echo Setup did not finish. Read the error above, then try again.
pause
exit /b 1
