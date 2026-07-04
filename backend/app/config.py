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

    # ── Mode d'impression ─────────────────────────────────────────────────────
    # "mock" → stub d'impression (log seulement)
    # "real" → impression réelle (via SumatraPDF sur Windows, lp sur Unix)
    PRINTING_MODE: str = "mock"

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Liste d'origines autorisées, séparées par des virgules.
    # Dev : inclure localhost. Production : URL réelle du frontend déployé.
    # NE JAMAIS utiliser "*" en prod avec allow_credentials=True (rejeté par les navigateurs).
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS (chaîne CSV) en liste d'origines nettoyées."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
