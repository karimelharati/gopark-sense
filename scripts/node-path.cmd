@echo off
where node >nul 2>nul
if not errorlevel 1 exit /b 0
if exist "%~dp0..\..\.tools\node\node.exe" (
  set "PATH=%~dp0..\..\.tools\node;%PATH%"
  exit /b 0
)
echo Install Node.js 22.13 or newer from https://nodejs.org/en/download
echo Then close this window and try again.
exit /b 1
