from __future__ import annotations

import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from buscar_atleticas_medicina import NORDESTE, normalize_uf, run_search, save_results

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "cocoon-template-1.0.1"

app = FastAPI(title="Atléticas Finder", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory=TEMPLATE_DIR), name="assets")


def sse_payload(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(TEMPLATE_DIR / "index.html")


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/download.csv")
async def download_csv() -> FileResponse:
    return FileResponse(
        BASE_DIR / "atleticas_encontradas.csv",
        media_type="text/csv",
        filename="atleticas_encontradas.csv",
    )


@app.get("/config")
async def config() -> dict:
    return {
        "ufs": sorted(NORDESTE),
        "defaultRegion": "Nordeste",
    }


@app.get("/buscar")
async def buscar(uf: str | None = Query(default=None, description="Filtra a busca por UF")) -> StreamingResponse:
    uf_filter = normalize_uf(uf)

    async def event_stream():
        queue: asyncio.Queue[tuple[str, dict] | None] = asyncio.Queue()

        async def on_profile(profile: dict) -> None:
            await queue.put(("profile", profile))

        async def on_progress(progress: dict) -> None:
            event_name = progress.get("type", "progress")
            await queue.put((event_name, progress))

        async def worker() -> None:
            try:
                profiles = await run_search(uf_filter, on_profile=on_profile, on_progress=on_progress)
                save_results(profiles, BASE_DIR)
            except Exception as exc:
                await queue.put(("error", {"message": str(exc)}))
            finally:
                await queue.put(None)

        task = asyncio.create_task(worker())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                event, payload = item
                yield sse_payload(event, payload)
        finally:
            if not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    import contextlib

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
