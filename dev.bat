@echo off
cd /d "%~dp0"
title NetX — Live Development App
cls
echo ========================================================
echo   NetX - Live Development App (Auto-Reloading & HMR)
echo ========================================================
echo.
echo Launching NetX development server...
echo - Any edits in src/ will update the app instantly via HMR.
echo - Any edits in electron/ will restart the app automatically.
echo - Press F12 in the app to toggle DevTools.
echo.
npm.cmd run dev
pause
