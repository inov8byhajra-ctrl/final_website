from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from app.api.endpoints import auth, users
from app.core.admin_seeding import create_default_admin
from app.core.database import AsyncSessionLocal, base, engine
from app.core.limiter import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create tables on start-up
    async with engine.begin() as conn:
        await conn.run_sync(base.metadata.create_all)

    # make sure the default admin account exists
    async with AsyncSessionLocal() as db:
        await create_default_admin(db)

    yield


app = FastAPI(title="InsightFlow Business Analytics API", lifespan=lifespan)

# The website is normally served by this same server (same origin), so CORS is only needed
# when the frontend is opened from somewhere else (e.g. VS Code Live Server on :5500).
# We authenticate with a Bearer token, not cookies, so credentials are not needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # same {"detail": ...} shape as every other error so the website can show it
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many attempts. Please wait a moment and try again."},
    )


app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users", tags=["Users & RBAC"])

# ---- serve the website (backend/../frontend) at "/" -------------------------------------
# Registered LAST so every /api/... route above wins.
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"message": "InsightFlow API is running"}
