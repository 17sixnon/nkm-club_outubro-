@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  HALLOWEEN NKM - Iniciando o site
echo ============================================
start "NKM Server" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
echo.
echo Iniciando o Cloudflare Tunnel (HTTPS publico)...
start "NKM HTTPS Tunnel" cmd /c ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000"
echo.
echo Aguarde some segundos para o tunnel gerar a URL publica.
echo.
echo Site (LAN):        http://192.168.1.150:3000
echo Admin (LAN):       http://192.168.1.150:3000/admin.html
echo.
echo A URL publica do tunnel sera mostrada na janela "NKM HTTPS Tunnel".
echo.
echo Token do ADM 1: NKM-ADM-Andreas17
echo Token do ADM 2: NKM-ADM-Gabriel18
echo.
echo Mantenha as duas janelas abertas. Feche-as para parar.
pause
