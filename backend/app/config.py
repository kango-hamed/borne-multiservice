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

    # ── Scan de document (scanner matériel de la borne) ───────────────────────
    # Nombre maximal de pages numérisées assemblées en un seul PDF
    MAX_SCAN_PAGES: int = 30

    # ── Scanner ───────────────────────────────────────────────────────────────
    # Mécanisme d'acquisition des pages depuis le matériel :
    #   "stub"           → page synthétique (dev, sans matériel)
    #   "wia"            → WIA / TWAIN sur Windows (scanner branché en local)
    #   "watched_folder" → l'usager scanne depuis le panneau de l'imprimante
    #                      (scan-to-folder) ; on récupère le fichier déposé
    #   "escl"           → imprimante réseau pilotée en HTTP (AirScan/Mopria)
    SCANNER_BACKEND: str = "stub"
    # Résolution de numérisation (points par pouce)
    SCANNER_DPI: int = 200
    # Nom du périphérique WIA à utiliser (vide = premier scanner disponible)
    SCANNER_NAME: str = ""
    # Dossier surveillé pour le mode "watched_folder"
    SCAN_WATCH_DIR: str = "./scan_inbox"
    # Délai maximal d'attente d'une page (dossier surveillé / matériel), en secondes
    SCAN_WATCH_TIMEOUT_SECONDS: int = 90
    # URL de base du scanner eSCL (ex: http://192.168.1.50:80) pour le mode "escl"
    SCANNER_ESCL_URL: str = ""

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
