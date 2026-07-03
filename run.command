#!/bin/bash
#
# Atléticas Finder — script de rodagem (macOS)
#
# Duas formas de usar:
#   1. Clicando duas vezes no arquivo pelo Finder.
#   2. No Terminal:  ./run.command
#
# Primeira execução: prepara Python, ambiente virtual e dependências.
# Próximas: só liga o servidor.

set -e
cd "$(dirname "$0")"

PORT=8000
URL="http://localhost:${PORT}"
MIN_MINOR=10   # o código usa sintaxe que exige Python 3.10+ (o 3.9 de fábrica NÃO serve)

echo "════════════════════════════════════════════════"
echo "  Atléticas Finder"
echo "════════════════════════════════════════════════"
echo

# ---------------------------------------------------------------------------
# 1. Garante um Python 3.10+ utilizável
# ---------------------------------------------------------------------------
is_python_ok() {
  "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, '"$MIN_MINOR"') else 1)' >/dev/null 2>&1
}

find_python() {
  for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && is_python_ok "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="$(find_python || true)"

if [ -z "$PYTHON_BIN" ]; then
  echo "→ Python 3.10+ não encontrado (o macOS só traz o 3.9). Instalando via Homebrew..."

  if ! command -v brew >/dev/null 2>&1; then
    echo "→ Instalando o Homebrew (pode pedir a senha do Mac)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -x /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi

  echo "→ Instalando o Python 3.12..."
  brew install python@3.12
  PYTHON_BIN="$(find_python || true)"
fi

if [ -z "$PYTHON_BIN" ]; then
  echo
  echo "✗ Não consegui preparar um Python 3.10+ automaticamente."
  echo "  Instale manualmente com:  brew install python@3.12"
  echo
  read -r -p "Pressione Enter para fechar..."
  exit 1
fi

echo "✓ Python: $($PYTHON_BIN --version)"

# ---------------------------------------------------------------------------
# 2. Ambiente virtual (recria se estiver com Python velho/quebrado)
# ---------------------------------------------------------------------------
if [ -d "venv" ] && ! is_python_ok "venv/bin/python"; then
  echo "→ venv antigo (Python < 3.${MIN_MINOR}) detectado. Recriando..."
  rm -rf venv
fi

if [ ! -d "venv" ]; then
  echo "→ Criando ambiente virtual..."
  "$PYTHON_BIN" -m venv venv
fi

# shellcheck disable=SC1091
source venv/bin/activate

# ---------------------------------------------------------------------------
# 3. Dependências (reinstala só quando o requirements.txt muda)
# ---------------------------------------------------------------------------
STAMP="venv/.requirements.sha"
CURRENT_SHA="$(shasum requirements.txt | awk '{print $1}')"

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$CURRENT_SHA" ]; then
  echo "→ Instalando dependências..."
  python -m ensurepip --upgrade >/dev/null 2>&1 || true
  python -m pip install --quiet --upgrade pip
  python -m pip install --quiet -r requirements.txt
  echo "$CURRENT_SHA" > "$STAMP"
  echo "✓ Dependências instaladas."
else
  echo "✓ Dependências já estão em dia."
fi

# ---------------------------------------------------------------------------
# 4. Sobe o servidor e abre o navegador
# ---------------------------------------------------------------------------
echo
echo "════════════════════════════════════════════════"
echo "  Servidor rodando em: $URL"
echo "  Para parar: tecle Ctrl+C nesta janela"
echo "════════════════════════════════════════════════"
echo

( sleep 2 && open "$URL" ) &
exec python -m uvicorn main:app --host 127.0.0.1 --port "$PORT"
