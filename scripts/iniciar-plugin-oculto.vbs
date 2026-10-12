' ===========================================================================
'  PLUGIN DE IA DO MOTOREDE - liga sem janela e religa se cair.
' ===========================================================================
'  E o que o atalho da pasta Inicializar chama (ver instalar-inicio-automatico.cmd).
'  Roda "node src/motorede-plugin.js" escondido; se o processo terminar
'  (erro, internet, navegador travado), espera 10 s e liga de novo.
'
'  O que acontece fica em .motorede-plugin.log, na pasta do projeto.
'  Para desligar: Gerenciador de Tarefas -> encerrar "wscript.exe" e "node.exe".
' ===========================================================================

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

' Pasta do projeto = a pasta acima de "scripts".
pasta = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = pasta

comando = "cmd /c node src\motorede-plugin.js >> .motorede-plugin.log 2>&1"

Do
  ' 0 = janela escondida; True = espera terminar antes de religar.
  sh.Run comando, 0, True
  WScript.Sleep 10000
Loop
