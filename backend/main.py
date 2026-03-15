from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import dotenv_router, speech_router, transcribe_router

from .routers import db_router, test_router, forum_router
from .utils.database import ensure_database_indexes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# routers
app.include_router(test_router.router, prefix="/test")
app.include_router(dotenv_router.router, prefix="/envs")
app.include_router(db_router.router, prefix="/db")
app.include_router(transcribe_router.router, prefix="/transcribe")
app.include_router(speech_router.router, prefix="/speech")
app.include_router(forum_router.router, prefix="/forum")


@app.on_event("startup")
async def configure_database_indexes():
    await ensure_database_indexes()
