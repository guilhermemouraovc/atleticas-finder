# Deploy — Atléticas Finder

Arquitetura: **GitHub Actions** (scraper agendado) → **Supabase** (banco) → **Vercel** (frontend estático).

```
GitHub Actions (cron semanal)
        │  roda buscar_atleticas_medicina.py
        ▼
   Supabase (Postgres)
        │  REST API (anon key, somente leitura)
        ▼
  Vercel (cocoon-template-1.0.1, estático)
```

## 1. Criar o projeto no Supabase

1. Crie uma conta/projeto em [supabase.com](https://supabase.com).
2. No painel do projeto, vá em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e rode.
   Isso cria a tabela `atleticas`, os índices em `estado` e `categoria`, e as policies de RLS
   (leitura pública para `anon`/`authenticated`, escrita só para `service_role`).
3. Em **Project Settings → API Keys**, anote:
   - **Project URL** (`SUPABASE_URL`) — algo como `https://xxxxxxxx.supabase.co`.
   - **anon public key** ou, em projetos novos, a **publishable key** (`sb_publishable_...`) —
     vai para o frontend, é pública por design (mesmo nível de acesso do anon key, respeita RLS).
   - **service_role key** ou, em projetos novos, a **secret key** (`sb_secret_...`) — **secreta**,
     só o GitHub Actions usa (ela ignora o RLS por completo). Nunca coloque essa chave no
     frontend ou em código versionado, nem a senha do banco de dados — nenhuma das duas é
     necessária para este projeto, que só fala com o Supabase via REST API.

## 2. Configurar os secrets no GitHub

No repositório do projeto: **Settings → Secrets and variables → Actions → New repository secret**.

Crie dois secrets:

| Nome                    | Valor                                  |
| ------------------------ | --------------------------------------- |
| `SUPABASE_URL`           | Project URL do passo 1                 |
| `SUPABASE_SERVICE_KEY`   | service_role key do passo 1 (secreta)  |

O workflow `.github/workflows/scraper.yml` já está configurado para:
- Rodar toda segunda-feira às 8h (horário de Brasília / 11h UTC).
- Poder ser disparado manualmente em **Actions → Scraper de Atléticas de Medicina → Run workflow**.
- Instalar `ddgs` e `supabase`, rodar `python buscar_atleticas_medicina.py`, que busca os perfis
  e faz upsert na tabela `atleticas` (chave de conflito: `username`).

Você pode testar localmente antes de depender do cron:

```bash
export SUPABASE_URL="https://xxxxxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="sua-service-role-key"
pip install -r requirements.txt
python buscar_atleticas_medicina.py
```

## 3. Configurar o frontend

Edite `cocoon-template-1.0.1/js/main.js` e substitua os dois placeholders no topo do arquivo:

```js
var SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
var SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

pelos valores reais do passo 1 (**Project URL** e **anon public key**). Essas duas informações
são seguras para ficar hardcoded no JS público — a proteção real é a RLS policy do banco, que só
permite `SELECT`.

## 4. Deploy no Vercel

1. Crie um projeto em [vercel.com](https://vercel.com) e conecte este repositório GitHub.
2. Em **Project Settings → General → Root Directory**, defina `cocoon-template-1.0.1`.
3. Como `cocoon-template-1.0.1/vercel.json` já tem `{"outputDirectory": "."}`, não é necessário
   configurar build command — é um deploy 100% estático (Framework Preset: **Other**).
4. Clique em **Deploy**.

A cada acesso à página, o `main.js` busca os dados direto em:

```
GET {SUPABASE_URL}/rest/v1/atleticas?select=*&order=estado.asc
Header: apikey: {SUPABASE_ANON_KEY}
```

e preenche a tabela e o filtro de UF no navegador — sem backend, sem servidor rodando.

## 5. Rotina normal de uso

- Toda segunda-feira o GitHub Actions roda o scraper e atualiza o Supabase.
- O site no Vercel sempre reflete o estado atual do banco (basta dar refresh na página).
- Para forçar uma nova varredura fora do cron, dispare o workflow manualmente
  (`workflow_dispatch`) em **Actions** no GitHub.
