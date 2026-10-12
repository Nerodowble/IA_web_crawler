@echo off
rem ===========================================================================
rem  Liga o plugin de IA do MotoRede junto com o Windows (no login).
rem  Cria um atalho na pasta Inicializar que chama iniciar-plugin-oculto.vbs.
rem  Para desfazer: remover-inicio-automatico.cmd
rem ===========================================================================

set "ALVO=%~dp0iniciar-plugin-oculto.vbs"
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MotoRede Plugin IA.lnk"

powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:ATALHO); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"' + $env:ALVO + '\"'; $s.WorkingDirectory = (Split-Path -Parent (Split-Path -Parent $env:ALVO)); $s.Description = 'Plugin de IA do MotoRede'; $s.Save()"

if exist "%ATALHO%" (
  echo Pronto: o plugin de IA liga sozinho no proximo login.
  echo Para ligar agora sem reiniciar: de dois cliques em scripts\iniciar-plugin-oculto.vbs
) else (
  echo Nao consegui criar o atalho.
)
pause
