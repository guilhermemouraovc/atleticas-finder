@echo off
REM Atleticas Finder - script de rodagem (Windows)
REM Clique duas vezes neste arquivo. Primeira vez: instala tudo. Depois: so liga o servidor.

setlocal enabledelayedexpansion
cd /d "%~dp0"
set PORT=8000
set URL=http://localhost:%PORT%

echo ================================================
echo   Atleticas Finder
echo ================================================
echo.

REM --- 1. Acha um Python 3.10+ ---
set "PYTHON="
for %%P in ("py -3.12" "py -3.11" "py -3.10" "py -3" "python") do (
    %%~P -c "import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>&1 && ( set "PYTHON=%%~P" & goto :have_python )
)

echo -^> Python 3.10+ nao encontrado. Instalando via winget...
winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
echo.
echo O Python foi instalado. FECHE esta janela e clique de novo no run.bat.
pause
exit /b 0

:have_python
for /f "delims=" %%V in ('%PYTHON% --version 2^>^&1') do echo Python: %%V

REM --- 2. Ambiente virtual (recria se estiver com Python velho) ---
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe -c "import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>&1 || (
        echo -^> venv antigo detectado. Recriando...
        rmdir /s /q venv
    )
)
if not exist venv (
    echo -^> Criando ambiente virtual...
    %PYTHON% -m venv venv
)
call venv\Scripts\activate.bat

REM --- 3. Dependencias (reinstala so quando o requirements.txt muda) ---
fc /b requirements.txt venv\.installed >nul 2>&1
if errorlevel 1 (
    echo -^> Instalando dependencias...
    python -m pip install --quiet --upgrade pip
    python -m pip install --quiet -r requirements.txt
    copy /y requirements.txt venv\.installed >nul
    echo Dependencias instaladas.
) else (
    echo Dependencias ja estao em dia.
)

REM --- 4. Sobe o servidor e abre o navegador ---
echo.
echo ================================================
echo   Servidor rodando em: %URL%
echo   Para parar: feche esta janela ou tecle Ctrl+C
echo ================================================
echo.
start "" %URL%
python -m uvicorn main:app --host 127.0.0.1 --port %PORT%
pause
