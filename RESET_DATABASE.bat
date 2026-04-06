@echo off
echo ========================================
echo    DATABASE RESET SCRIPT
echo ========================================
echo.
echo This will clear all data and create fresh database
echo A backup will be created automatically
echo.
pause
node reset-database.js
echo.
echo ========================================
echo    Database reset complete!
echo ========================================
echo.
echo Next steps:
echo 1. Start server: node server.js
echo 2. Create admin account
echo 3. Create exam and test
echo.
pause
