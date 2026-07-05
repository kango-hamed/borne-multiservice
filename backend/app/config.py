from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Base de données ───────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost/borne_db"

    # ── Sécurité ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "changeme"

    # ── Fichiers uploadés ─────────────────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 20

    # ── Scan de document (caméra téléphone) ───────────────────────────────────
    # Nombre maximal de pages photographiées assemblées en un seul PDF
    MAX_SCAN_PAGES: int = 30

    # ── Sessions ──────────────────────────────────────────────────────────────
    SESSION_EXPIRY_MINUTES: int = 10

    # ── Worker d'impression ───────────────────────────────────────────────────
    WORKER_POLL_INTERVAL_SECONDS: int = 2

    # ── Paiement mock ─────────────────────────────────────────────────────────
    PAYMENT_MOCK_DELAY_SECONDS: int = 5

    # ── Impression Windows ────────────────────────────────────────────────────
    # Nom exact de l'imprimante Windows (vide = imprimante par défaut)
    PRINTER_NAME: str = ""
    # Chemin vers SumatraPDF.exe portable
    SUMATRA_PATH: str = r".\bin\SumatraPDF.exe"

    # ── Environnement ─────────────────────────────────────────────────────────
    # "development" → stub d'impression (log seulement)
    # "production"  → impression réelle via SumatraPDF + pywin32
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
