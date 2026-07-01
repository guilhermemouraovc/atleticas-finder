"""
Varredura de Atléticas de Medicina no Instagram.

Pode ser usado de duas formas:
1. Como script standalone para salvar CSV/JSON.
2. Como módulo assíncrono para emitir cada perfil encontrado em tempo real.
"""

from __future__ import annotations

import asyncio
import csv
import inspect
import json
import os
import random
import re
from collections.abc import Awaitable, Callable
from pathlib import Path

from ddgs import DDGS

# ---------------------------------------------------------------------------
# QUERIES
# ---------------------------------------------------------------------------

GENERIC_QUERIES = [
    'site:instagram.com "atlética" "medicina" brasil',
    'site:instagram.com "atletica de medicina"',
    'site:instagram.com "atlética medicina" nordeste',
    'site:instagram.com "AAA" "medicina" atlética',
    'site:instagram.com "associação atlética acadêmica" medicina',
    'site:instagram.com "A.A.A" "medicina"',
    'site:instagram.com "intermed" "medicina" atlética',
    'site:instagram.com "DENEM" "medicina" atlética',
]

STATE_QUERIES = {
    "AL": [
        'site:instagram.com "medicina" "atlética" alagoas',
        'site:instagram.com "medicina" "atlética" UFAL',
        'site:instagram.com "medicina" "atlética" UNCISAL',
        'site:instagram.com "medicina" "atlética" CESMAC',
    ],
    "BA": [
        'site:instagram.com "medicina" "atlética" bahia',
        'site:instagram.com "medicina" "atlética" UFBA',
        'site:instagram.com "medicina" "atlética" UNEB',
        'site:instagram.com "medicina" "atlética" UESC',
        'site:instagram.com "medicina" "atlética" UFOB',
    ],
    "CE": [
        'site:instagram.com "medicina" "atlética" ceará',
        'site:instagram.com "medicina" "atlética" UFC',
        'site:instagram.com "medicina" "atlética" UNIFOR',
        'site:instagram.com "medicina" "atlética" UNICHRISTUS',
        'site:instagram.com "medicina" "atlética" CHRISTUS',
    ],
    "MA": [
        'site:instagram.com "medicina" "atlética" maranhão',
        'site:instagram.com "medicina" "atlética" UFMA',
        'site:instagram.com "medicina" "atlética" UNICEUMA',
    ],
    "PB": [
        'site:instagram.com "medicina" "atlética" paraíba',
        'site:instagram.com "medicina" "atlética" UFPB',
        'site:instagram.com "medicina" "atlética" UEPB',
        'site:instagram.com "medicina" "atlética" FACISA',
        'site:instagram.com "medicina" "atlética" FAMENE',
    ],
    "PE": [
        'site:instagram.com "medicina" "atlética" pernambuco',
        'site:instagram.com "medicina" "atlética" UFPE',
        'site:instagram.com "medicina" "atlética" UPE',
        'site:instagram.com "medicina" "atlética" FPS',
        'site:instagram.com "medicina" "atlética" UNINASSAU',
        'site:instagram.com "medicina" "atlética" FBV',
    ],
    "PI": [
        'site:instagram.com "medicina" "atlética" piauí',
        'site:instagram.com "medicina" "atlética" UFPI',
        'site:instagram.com "medicina" "atlética" FACID',
        'site:instagram.com "medicina" "atlética" UNINOVAFAPI',
    ],
    "RN": [
        'site:instagram.com "medicina" "atlética" "rio grande do norte"',
        'site:instagram.com "medicina" "atlética" UFRN',
        'site:instagram.com "medicina" "atlética" UNIFACEX',
        'site:instagram.com "medicina" "atlética" FACERN',
    ],
    "SE": [
        'site:instagram.com "medicina" "atlética" sergipe',
        'site:instagram.com "medicina" "atlética" UFS',
        'site:instagram.com "medicina" "atlética" UNIT',
        'site:instagram.com "medicina" "atlética" FITS',
    ],
}

DEFAULT_STATE_ORDER = ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]

# ---------------------------------------------------------------------------
# MAPEAMENTOS
# ---------------------------------------------------------------------------

UNIV_MAP = {
    "UFAL": "AL",
    "UNCISAL": "AL",
    "CESMAC": "AL",
    "UFBA": "BA",
    "UNEB": "BA",
    "UESC": "BA",
    "UFOB": "BA",
    "UFC": "CE",
    "UNICHRISTUS": "CE",
    "UNIFOR": "CE",
    "CHRISTUS": "CE",
    "UFMA": "MA",
    "UNICEUMA": "MA",
    "UFPB": "PB",
    "UEPB": "PB",
    "FACISA": "PB",
    "UNIFIP": "PB",
    "FAMENE": "PB",
    "UFPE": "PE",
    "UPE": "PE",
    "FPS": "PE",
    "UNINASSAU": "PE",
    "FBV": "PE",
    "UFPI": "PI",
    "UNINOVAFAPI": "PI",
    "FACID": "PI",
    "UFRN": "RN",
    "UNIFACEX": "RN",
    "FACERN": "RN",
    "UFS": "SE",
    "UNIT": "SE",
    "FITS": "SE",
    "USP": "SP",
    "UNIFESP": "SP",
    "UNICAMP": "SP",
    "UFRJ": "RJ",
    "UFF": "RJ",
    "UERJ": "RJ",
    "UFMG": "MG",
    "UFTM": "MG",
    "UFPR": "PR",
    "UEM": "PR",
    "UNIOESTE": "PR",
    "UFRGS": "RS",
    "UFCSPA": "RS",
    "UFSC": "SC",
    "UNISUL": "SC",
    "UNB": "DF",
    "UCB": "DF",
    "UFMT": "MT",
    "UNIC": "MT",
    "UFG": "GO",
    "UFAM": "AM",
    "UEA": "AM",
    "UFPA": "PA",
    "UEPA": "PA",
}

ESTADO_MAP = {
    "alagoas": "AL",
    "al ": "AL",
    "bahia": "BA",
    "salvador": "BA",
    "ceará": "CE",
    "fortaleza": "CE",
    "maranhão": "MA",
    "são luís": "MA",
    "paraíba": "PB",
    "joão pessoa": "PB",
    "campina grande": "PB",
    "pernambuco": "PE",
    "recife": "PE",
    "caruaru": "PE",
    "piauí": "PI",
    "teresina": "PI",
    "rio grande do norte": "RN",
    "natal": "RN",
    "mossoró": "RN",
    "sergipe": "SE",
    "aracaju": "SE",
    "maceió": "AL",
    "são paulo": "SP",
    "rio de janeiro": "RJ",
    "minas gerais": "MG",
    "belo horizonte": "MG",
    "paraná": "PR",
    "curitiba": "PR",
    "rio grande do sul": "RS",
    "porto alegre": "RS",
    "santa catarina": "SC",
    "florianópolis": "SC",
    "distrito federal": "DF",
    "brasília": "DF",
    "goiás": "GO",
    "goiânia": "GO",
    "amazonas": "AM",
    "manaus": "AM",
    "pará": "PA",
    "belém": "PA",
    "mato grosso": "MT",
    "cuiabá": "MT",
}

NORDESTE = {"AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"}
SKIP = {"p", "explore", "reel", "tv", "stories", "reels", "accounts", "tags"}
KEYWORDS = ["medicina", "atlética", "atletica", "intermed", "aaa", "associação atlética"]
IG_PATTERN = re.compile(r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]+)/?")
POSITIVE_SIGNALS = [
    ("atlética", 2, "atlética"),
    ("atletica", 2, "atletica"),
    ("associação atlética", 3, "associação atlética"),
    ("aaa", 2, "aaa"),
    ("medicina", 3, "medicina"),
    ("faculdade de medicina", 4, "faculdade de medicina"),
    ("curso de medicina", 4, "curso de medicina"),
    ("acadêmicos de medicina", 4, "acadêmicos de medicina"),
    ("academicos de medicina", 4, "academicos de medicina"),
    ("estudantes de medicina", 4, "estudantes de medicina"),
    ("intermed", 4, "intermed"),
    ("internato", 2, "internato"),
    ("semiologia", 2, "semiologia"),
    ("anatomia", 1, "anatomia"),
    ("medschool", 2, "medschool"),
    ("medicina uf", 3, "medicina uf"),
]
NEGATIVE_SIGNALS = [
    ("veterinária", -10, "veterinária"),
    ("veterinaria", -10, "veterinaria"),
    ("medicina veterinária", -12, "medicina veterinária"),
    ("medicina veterinaria", -12, "medicina veterinaria"),
    ("med vet", -10, "med vet"),
    ("vet ", -4, "vet"),
    ("zootecnia", -8, "zootecnia"),
    ("agronomia", -6, "agronomia"),
]
EMIT_CATEGORIES = {"confirmado_medicina", "provavel_medicina"}

ProfileCallback = Callable[[dict], Awaitable[None] | None]
ProgressCallback = Callable[[dict], Awaitable[None] | None]


def build_queries(uf: str | None = None) -> list[str]:
    uf = normalize_uf(uf)
    if uf:
        return [*GENERIC_QUERIES, *STATE_QUERIES.get(uf, [])]

    queries = list(GENERIC_QUERIES)
    for state in DEFAULT_STATE_ORDER:
        queries.extend(STATE_QUERIES[state])
    return queries


def normalize_uf(uf: str | None) -> str | None:
    if not uf:
        return None
    cleaned = uf.strip().upper()
    return cleaned if cleaned in STATE_QUERIES else None


async def maybe_await(result: Awaitable[None] | None) -> None:
    if inspect.isawaitable(result):
        await result


def extract_username(url: str) -> str | None:
    match = IG_PATTERN.match(url)
    if not match:
        return None

    username = match.group(1).lower()
    return username if username not in SKIP else None


def extract_univ(text: str) -> str:
    text_upper = text.upper()
    for univ in UNIV_MAP:
        if re.search(rf"\b{re.escape(univ)}\b", text_upper):
            return univ
    return ""


def extract_estado(text: str, univ: str) -> str:
    if univ and univ in UNIV_MAP:
        return UNIV_MAP[univ]

    text_lower = text.lower()
    for term, uf in ESTADO_MAP.items():
        if term in text_lower:
            return uf
    return ""


def classify_profile(text: str, university: str) -> dict:
    text_lower = text.lower()
    score = 0
    match_reasons: list[str] = []
    exclusion_reasons: list[str] = []

    for term, points, reason in POSITIVE_SIGNALS:
        if term in text_lower:
            score += points
            match_reasons.append(reason)

    for term, points, reason in NEGATIVE_SIGNALS:
        if term in text_lower:
            score += points
            exclusion_reasons.append(reason)

    if university:
        score += 3
        match_reasons.append(f"universidade:{university}")

    if any(keyword in text_lower for keyword in KEYWORDS):
        score += 1
        match_reasons.append("keyword_base")

    if exclusion_reasons:
        category = "excluido_veterinaria"
    elif score >= 8:
        category = "confirmado_medicina"
    elif score >= 4:
        category = "provavel_medicina"
    else:
        category = "duvidoso"

    return {
        "score": score,
        "categoria": category,
        "motivos_match": sorted(set(match_reasons)),
        "motivos_exclusao": sorted(set(exclusion_reasons)),
    }


def clean_snippet(snippet: str) -> str:
    snippet = re.sub(r"^\d[\d,K]* Followers.*?- ", "", snippet).strip()
    return snippet[:280]


async def search_query(
    ddgs: DDGS,
    query: str,
    sem: asyncio.Semaphore,
    idx: int,
    found: dict[str, dict],
    uf_filter: str | None = None,
    on_profile: ProfileCallback | None = None,
    on_progress: ProgressCallback | None = None,
) -> None:
    async with sem:
        added = 0
        try:
            results = await asyncio.to_thread(ddgs.text, query, max_results=15, region="br-pt")
            for result in results:
                url = result.get("href", "")
                title = result.get("title", "")
                snippet = result.get("body", "")
                combined = f"{title} {snippet}"

                username = extract_username(url)
                if not username or username in found:
                    continue

                university = extract_univ(combined)
                classification = classify_profile(combined, university)
                if classification["categoria"] not in EMIT_CATEGORIES:
                    continue

                estado = extract_estado(combined, university)
                if uf_filter and estado and estado != uf_filter:
                    continue

                profile = {
                    "username": f"@{username}",
                    "url": f"https://www.instagram.com/{username}/",
                    "estado": estado,
                    "nordeste": "✓" if estado in NORDESTE else "",
                    "universidade": university,
                    "bio": clean_snippet(snippet),
                    "query": query,
                    "score": classification["score"],
                    "categoria": classification["categoria"],
                    "motivos_match": classification["motivos_match"],
                    "motivos_exclusao": classification["motivos_exclusao"],
                }
                found[username] = profile
                added += 1
                if on_profile:
                    await maybe_await(on_profile(profile))

        except Exception as exc:
            if on_progress:
                await maybe_await(
                    on_progress(
                        {
                            "type": "query_error",
                            "index": idx,
                            "query": query,
                            "message": str(exc),
                            "total_found": len(found),
                        }
                    )
                )
        else:
            if on_progress:
                await maybe_await(
                    on_progress(
                        {
                            "type": "query_done",
                            "index": idx,
                            "query": query,
                            "new_items": added,
                            "total_found": len(found),
                        }
                    )
                )

        await asyncio.sleep(random.uniform(0.5, 1.2))


async def run_search(
    uf: str | None = None,
    *,
    on_profile: ProfileCallback | None = None,
    on_progress: ProgressCallback | None = None,
    concurrency: int = 6,
) -> list[dict]:
    uf_filter = normalize_uf(uf)
    queries = build_queries(uf_filter)
    found: dict[str, dict] = {}

    if on_progress:
        await maybe_await(
            on_progress(
                {
                    "type": "start",
                    "query_count": len(queries),
                    "uf": uf_filter,
                    "concurrency": concurrency,
                }
            )
        )

    sem = asyncio.Semaphore(concurrency)
    with DDGS() as ddgs:
        tasks = [
            search_query(
                ddgs,
                query,
                sem,
                index + 1,
                found,
                uf_filter=uf_filter,
                on_profile=on_profile,
                on_progress=on_progress,
            )
            for index, query in enumerate(queries)
        ]
        await asyncio.gather(*tasks)

    profiles = sorted(found.values(), key=lambda item: (item["estado"], item["username"]))
    if on_progress:
        await maybe_await(
            on_progress(
                {
                    "type": "done",
                    "query_count": len(queries),
                    "uf": uf_filter,
                    "total_found": len(profiles),
                }
            )
        )
    return profiles


def save_results(profiles: list[dict], base_path: str | Path = ".") -> None:
    base = Path(base_path)
    csv_path = base / "atleticas_encontradas.csv"
    json_path = base / "atleticas_encontradas.json"
    fields = [
        "username",
        "url",
        "estado",
        "nordeste",
        "universidade",
        "categoria",
        "score",
        "motivos_match",
        "motivos_exclusao",
        "bio",
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        rows = []
        for profile in profiles:
            row = {key: profile.get(key, "") for key in fields}
            row["motivos_match"] = " | ".join(profile.get("motivos_match", []))
            row["motivos_exclusao"] = " | ".join(profile.get("motivos_exclusao", []))
            rows.append(row)
        writer.writerows(rows)

    with json_path.open("w", encoding="utf-8") as file:
        json.dump(profiles, file, ensure_ascii=False, indent=2)


def print_results(profiles: list[dict]) -> None:
    print(f"\n{'═' * 65}")
    print(f"  {len(profiles)} atléticas encontradas")
    print(f"{'═' * 65}")
    print(f"  {'PERFIL':<30} {'UF':^4} {'SC':^4} {'CAT':<22}")
    print(f"  {'─' * 28} {'─' * 4} {'─' * 4} {'─' * 22}")
    for profile in profiles:
        print(
            f"  {profile['username']:<30} {profile['estado']:^4} {profile['score']:^4} "
            f"{profile['categoria']:<22}"
        )

    print("\n  Salvos em: atleticas_encontradas.csv  |  atleticas_encontradas.json")


# ---------------------------------------------------------------------------
# SUPABASE
# ---------------------------------------------------------------------------

SUPABASE_TABLE = "atleticas"
SUPABASE_FIELDS = [
    "username",
    "url",
    "estado",
    "nordeste",
    "universidade",
    "categoria",
    "score",
    "motivos_match",
    "motivos_exclusao",
    "bio",
]


def save_to_supabase(profiles: list[dict], supabase_url: str, supabase_key: str) -> int:
    """Faz upsert dos perfis encontrados na tabela `atleticas` do Supabase.

    Usa `username` como chave de conflito, então rodar o scraper várias vezes
    (ex.: toda semana via GitHub Actions) atualiza os registros existentes em
    vez de duplicá-los.

    Retorna a quantidade de linhas enviadas. Não faz nada (retorna 0) se a
    lista de perfis estiver vazia.
    """
    if not profiles:
        print("Nenhum perfil para enviar ao Supabase.")
        return 0

    if not supabase_url or not supabase_key:
        raise ValueError("supabase_url e supabase_key são obrigatórios para save_to_supabase().")

    from supabase import Client, create_client

    client: Client = create_client(supabase_url, supabase_key)

    rows = []
    for profile in profiles:
        row = {field: profile.get(field) for field in SUPABASE_FIELDS}
        rows.append(row)

    # Envia em lotes para evitar payloads gigantes em buscas grandes.
    batch_size = 200
    sent = 0
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        client.table(SUPABASE_TABLE).upsert(batch, on_conflict="username").execute()
        sent += len(batch)

    print(f"Supabase: {sent} perfil(is) enviados (upsert por username) para '{SUPABASE_TABLE}'.")
    return sent


async def main() -> None:
    print("═" * 65)
    print("  VARREDURA DE ATLÉTICAS DE MEDICINA — async")
    print(f"  {len(build_queries())} queries em paralelo (máx. 6 simultâneas)")
    print("═" * 65 + "\n")

    profiles = await run_search()
    save_results(profiles)
    print_results(profiles)

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if supabase_url and supabase_key:
        save_to_supabase(profiles, supabase_url, supabase_key)
    else:
        print(
            "\nSUPABASE_URL / SUPABASE_SERVICE_KEY não configurados — "
            "pulando envio ao Supabase (apenas CSV/JSON locais foram salvos)."
        )


if __name__ == "__main__":
    asyncio.run(main())
