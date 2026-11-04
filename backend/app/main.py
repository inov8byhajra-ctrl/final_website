import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from app.core.admin_seeding import create_default_admin
from app.core.database import AsyncSessionLocal, base, engine
from app.core.limiter import limiter
from app.core.scheduler import start_scheduler, scheduler

from app.api.endpoints import admin, cfo, regional_manager, users, upload, activity

# Set APP_ENV=prod in your .env / server to hide /docs and allow only your real domain.
IS_DEV = os.getenv("APP_ENV", "dev") == "dev"

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create any missing tables on start-up
    async with engine.begin() as conn:
        await conn.run_sync(base.metadata.create_all)

    # make sure the default admin account exists
    async with AsyncSessionLocal() as db:
        await create_default_admin(db)

    # start the background jobs (expired accounts, old invitations, old notifications)
    start_scheduler()

    yield

    # stop the background jobs when the server shuts down
    scheduler.shutdown()


app = FastAPI(
    title="InsightFlow Business Analytics API",
    lifespan=lifespan,
    docs_url="/docs" if IS_DEV else None,
    redoc_url=None,
    openapi_url="/openapi.json" if IS_DEV else None,
)

# The website is normally served by this same server (same origin), so CORS is only needed
# when the frontend is opened from somewhere else (e.g. VS Code Live Server on :5500).
# We authenticate with a Bearer token, not cookies, so credentials are not needed.
ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    # "https://your-domain.com",   # add your deployed domain here
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter


@app.middleware("http")
async def clean_urls(request: Request, call_next):
    """Hide the .html extension: /admin/approvals.html -> /admin/approvals"""
    path = request.url.path
    if request.method in ("GET", "HEAD") and not path.startswith("/api"):
        # block "/\evil.com" style paths (browsers treat \ like /)
        if "\\" in path:
            return JSONResponse({"detail": "Not found"}, status_code=404)

        # 1) old-style link with .html -> redirect to the clean URL (query string kept)
        if path.endswith(".html"):
            clean = "/" + path[:-5].lstrip("/")      # collapse leading slashes (open-redirect fix)
            if clean.endswith("/index"):
                clean = clean[:-5] or "/"            # /index.html -> /
            qs = request.url.query
            return RedirectResponse(clean + ("?" + qs if qs else ""), status_code=308)

        # 2) clean URL typed/clicked in the browser -> serve the matching .html file
        is_page = (
            request.headers.get("sec-fetch-dest") == "document"
            or "text/html" in request.headers.get("accept", "")
        )
        if is_page and path != "/" and "." not in path.rsplit("/", 1)[-1]:
            f = (FRONTEND_DIR / (path.lstrip("/") + ".html")).resolve()
            if f.is_file() and FRONTEND_DIR.resolve() in f.parents:
                request.scope["path"] = path + ".html"
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return resp


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # same {"detail": ...} shape as every other error so the website can show it
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many attempts. Please wait a moment and try again."},
    )


app.include_router(admin.router)
app.include_router(cfo.router)
app.include_router(regional_manager.router)
app.include_router(users.router, prefix="/api/users", tags=["Users & RBAC"])
app.include_router(upload.router)
app.include_router(activity.router)


# ---- serve the website (backend/../frontend) at "/" -------------------------------------
# Registered LAST so every /api/... route above wins.
class NoCacheStaticFiles(StaticFiles):
    """Serve the website with 'Cache-Control: no-cache': the browser must re-check with the
    server on every load (a cheap 304 if nothing changed), so an updated admin.html / api.js /
    app.js always shows up, no Ctrl+Shift+R needed."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code in (200, 304):
            response.headers["Cache-Control"] = "no-cache"
        return response


if FRONTEND_DIR.is_dir():
    app.mount("/", NoCacheStaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"message": "InsightFlow API is running"}