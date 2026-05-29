@echo off
title Aviator Casino - Servidor Local
color 0A

echo ====================================================
echo             AVIATOR CASINO - STARTUP LOG
echo ====================================================
echo.
echo Iniciando o servidor Flask e Socket.IO...
echo.
echo Acesse o jogo em: http://localhost:5000
echo Acesse o Admin em: http://localhost:5000/admin
echo.
echo Pressione CTRL+C para desligar o servidor.
echo ====================================================
echo.

python app.py

pause
