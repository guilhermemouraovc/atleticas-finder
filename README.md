# Atléticas Finder

Busca atléticas de medicina no Instagram (via DuckDuckGo) e mostra os resultados
numa interface web local, com exportação para CSV. Tudo roda no seu computador —
sem banco de dados, sem servidor central.

## Como usar

- **Mac:** clique duas vezes em `run.command` (ou rode `./run.command` no Terminal).
- **Windows:** clique duas vezes em `run.bat`.

Na primeira vez o script instala o Python (se preciso), cria o ambiente virtual e
instala as dependências. Depois ele só liga o servidor e abre o navegador em
`http://localhost:8000`.

Na página: escolha (ou não) uma UF, clique em **Iniciar busca**, acompanhe os
perfis aparecendo em tempo real e use **Exportar CSV** para baixar o resultado.

## Linha de comando (opcional)

```bash
python buscar_atleticas_medicina.py
```

Roda a busca completa e salva `atleticas_encontradas.csv` e
`atleticas_encontradas.json` na pasta do projeto.

## Requisitos

Python 3.10+. Dependências em `requirements.txt` (FastAPI, Uvicorn e ddgs).
