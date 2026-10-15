@echo off
cd /d "%~dp0"
call npm install || goto :err
call npm run setup || goto :err
echo.
echo Menjalankan server di http://localhost:3000 (tekan Ctrl+C untuk berhenti)
call npm start
goto :eof
:err
echo.
echo Terjadi error di langkah di atas. Baca pesannya, lalu coba lagi.
pause
