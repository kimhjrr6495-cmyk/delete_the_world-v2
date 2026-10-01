@echo off
setlocal
chcp 65001 >nul
set "GAME_NODE_EXE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined GAME_NODE_EXE set "GAME_NODE_EXE=%%N"
if not defined GAME_NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "GAME_NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined GAME_NODE_EXE (
  echo Node.js 20 이상을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
"%GAME_NODE_EXE%" "%~dp0scripts\launch.js" %*
if errorlevel 1 pause
