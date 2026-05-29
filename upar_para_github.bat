@echo off
title Upar para o GitHub
color 0B
echo ==============================================
echo ENVIANDO ARQUIVOS DO AVIATOR PARA O GITHUB...
echo ==============================================
echo.

git init
git add .
git commit -m "Meu projeto Aviator"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Eduffclt/rrrrrrrr.git
git push -u origin main -f

echo.
echo ==============================================
echo PRONTO! Arquivos enviados.
echo Agora voce pode voltar na tela do Vercel e clicar no botao preto "Deploy"!
echo ==============================================
pause
