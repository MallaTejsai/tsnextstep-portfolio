Option Explicit
Dim shell, files, script, command, mode, node, noOpen, code
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
If WScript.Arguments.Count < 2 Or WScript.Arguments.Count > 3 Then WScript.Quit 2
mode = WScript.Arguments(0)
node = WScript.Arguments(1)
noOpen = ""
If WScript.Arguments.Count = 3 Then
  If WScript.Arguments(2) <> "--no-open" Then WScript.Quit 2
  noOpen = " -NoOpen"
End If
script = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "launch-local.ps1")
command = Quote(shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")) & _
  " -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Quote(script) & _
  " -Mode " & Quote(mode) & " -NodePath " & Quote(node) & noOpen
code = shell.Run(command, 0, True)
WScript.Quit code

Function Quote(value)
  If InStr(value, Chr(34)) > 0 Then WScript.Quit 2
  Quote = Chr(34) & value & Chr(34)
End Function
