from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import db_router, test_router

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
app.include_router(db_router.router, prefix="/db")
