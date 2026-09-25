from fastapi import FastAPI

app = FastAPI(title="OpenChat API")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


def main() -> None:
    import uvicorn

    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)
