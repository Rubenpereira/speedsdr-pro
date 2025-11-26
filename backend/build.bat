@echo off
setlocal

echo [INFO] Build SpeedSDR Pro Backend x86 (32-bit)
echo.

REM Forcar x86
set OUTNAME=SpeedSDR_Pro.exe

REM Listar arquivos antes de compilar (debug)
echo [DEBUG] Arquivos na pasta:
dir /B *.cpp *.h *.dll 2>nul

echo.
echo [INFO] Compilando...
cl /EHsc /std:c++17 /W3 main.cpp /link /MACHINE:X86 ws2_32.lib rtlsdr.lib /OUT:%OUTNAME%

if errorlevel 1 (
  echo.
  echo [ERRO] Falha na compilacao!
  echo Verificacoes:
  echo 1. Voce abriu o "x86 Native Tools Command Prompt for VS 2022"?
  echo 2. Os arquivos main.cpp, rtlsdr.h e rtlsdr.dll existem nesta pasta?
  echo 3. Tente rodar: dir main.cpp rtlsdr.dll
  echo.
  pause
  exit /b 1
)

echo.
echo [SUCESSO] %OUTNAME% criado!
echo Arquivo: %CD%\%OUTNAME%
echo.
pause
exit /b 0