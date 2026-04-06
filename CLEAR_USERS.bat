@echo off
echo ========================================
echo    CLEAR USER ACCOUNTS SCRIPT
echo ========================================
echo.
echo This will remove ALL user accounts and login credentials
echo Exams, questions, sessions, and evidence will be preserved
echo A backup will be created automatically
echo.
pause
node clear-users.js
echo.
echo ========================================
echo    User accounts cleared!
echo ========================================
echo.
echo Next steps:
echo 1. Start server: node server.js
echo 2. Create new admin account via signup
echo 3. Create student/proctor accounts as needed
echo 4. Test with fresh credentials
echo.
pause
