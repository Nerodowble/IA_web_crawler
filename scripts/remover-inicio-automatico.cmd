@echo off
rem Desfaz o instalar-inicio-automatico.cmd. Nao desliga o que ja esta rodando.
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MotoRede Plugin IA.lnk"
if exist "%ATALHO%" del "%ATALHO%"
echo O plugin de IA nao liga mais com o Windows.
pause
