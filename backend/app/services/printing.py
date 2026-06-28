"""
printing.py — Service d'impression Windows.

Deux modes selon settings.ENVIRONMENT :
  - "development" : stub qui loggue sans imprimer (pas d'imprimante requise)
  - "production"  : impression réelle via SumatraPDF CLI + pywin32

SumatraPDF doit être présent dans backend/bin/SumatraPDF.exe
Téléchargement : https://www.sumatrapdfreader.org/download-free-pdf-viewer
"""
import asyncio
import logging
from pathlib import Path

from app.config import settings
from app.models.print_job import PrintJob

logger = logging.getLogger(__name__)


async def send_to_printer(job: PrintJob) -> bool:
    """
    Envoie un job d'impression à l'imprimante.
    Dispatch selon l'environnement.
    """
    if not settings.is_production:
        return await _stub_print(job)
    return await _windows_print(job)


async def list_available_printers() -> tuple[list[str], str | None]:
    """
    Liste les imprimantes Windows disponibles.
    Retourne (liste_noms, imprimante_par_defaut).
    """
    if not settings.is_production:
        return (["Imprimante de test (stub)"], "Imprimante de test (stub)")

    try:
        import win32print
        printers_raw = win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        )
        printer_names = [p[2] for p in printers_raw]
        default = win32print.GetDefaultPrinter()
        return (printer_names, default)
    except Exception as e:
        logger.error(f"Impossible de lister les imprimantes : {e}")
        return ([], None)


# ── Mode développement (stub) ─────────────────────────────────────────────────

async def _stub_print(job: PrintJob) -> bool:
    """Simule l'impression sans imprimante réelle."""
    logger.info(
        f"[STUB] Impression simulée — "
        f"job={job.id} | fichier={job.original_filename} | "
        f"pages={job.pages} | copies={job.copies} | "
        f"mode={job.color_mode} | duplex={job.duplex}"
    )
    # Simule le temps d'impression (~ 2 sec par page en N&B)
    await asyncio.sleep(min(job.pages * 0.5, 3))
    return True


# ── Mode production (Windows) ─────────────────────────────────────────────────

async def _windows_print(job: PrintJob) -> bool:
    """
    Impression réelle via SumatraPDF CLI.
    Supporte : PDF, JPG, PNG
    """
    file_path = Path(job.file_path)
    ext = file_path.suffix.lower()

    if ext not in (".pdf", ".jpg", ".jpeg", ".png"):
        logger.warning(
            f"Format non supporté pour impression directe : {ext} "
            f"(job={job.id}). Conversion requise."
        )
        return False

    printer_name = await _resolve_printer_name()
    if printer_name is None:
        logger.error("Aucune imprimante disponible.")
        return False

    sumatra_settings = _build_sumatra_settings(job)

    cmd = [
        settings.SUMATRA_PATH,
        "-print-to", printer_name,
        "-print-settings", sumatra_settings,
        "-silent",             # Pas de fenêtre UI
        str(file_path),
    ]

    logger.info(
        f"[PRINT] Lancement impression — "
        f"job={job.id} | printer={printer_name} | settings={sumatra_settings}"
    )

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60.0)

        if proc.returncode != 0:
            logger.error(
                f"SumatraPDF erreur (code {proc.returncode}) — "
                f"job={job.id} | stderr={stderr.decode(errors='replace')}"
            )
            return False

        logger.info(f"[PRINT] Impression envoyée avec succès — job={job.id}")
        return True

    except asyncio.TimeoutError:
        logger.error(f"[PRINT] Timeout d'impression — job={job.id}")
        proc.kill()
        return False
    except FileNotFoundError:
        logger.error(
            f"SumatraPDF introuvable à l'emplacement : {settings.SUMATRA_PATH}. "
            f"Télécharger depuis https://www.sumatrapdfreader.org/"
        )
        return False
    except Exception as e:
        logger.error(f"[PRINT] Erreur inattendue — job={job.id} : {e}")
        return False


async def _resolve_printer_name() -> str | None:
    """Résout le nom de l'imprimante à utiliser."""
    if settings.PRINTER_NAME:
        return settings.PRINTER_NAME
    try:
        import win32print
        return win32print.GetDefaultPrinter()
    except Exception:
        return None


def _build_sumatra_settings(job: PrintJob) -> str:
    """
    Construit la chaîne de paramètres SumatraPDF.

    Format : "{copies}x,{color},{duplex}"
    Exemples :
      - "1x,monochrome"         → 1 copie, N&B, recto
      - "2x,color,duplexlong"   → 2 copies, couleur, recto-verso bord long
    """
    parts: list[str] = [f"{job.copies}x"]
    parts.append("color" if job.color_mode == "couleur" else "monochrome")
    if job.duplex:
        parts.append("duplexlong")  # Reliure bord long (standard A4 portrait)
    return ",".join(parts)
