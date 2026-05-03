# source venv/bin/activate
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import uvicorn

from api.auth import router as auth_router
from api.ws import router as ws_router
from api.portfolio import router as portfolio_router
from auth.database import engine
from seed import seed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info("Connected to Postgres")
        seed()
        logger.info("Inject Data Completed")
    except Exception as error:
        logger.exception("Database connection failed: %s", error)
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ws_router)
app.include_router(portfolio_router)

@app.get("/")
def main():
    return {"Welcome to main"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)