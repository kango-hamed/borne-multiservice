"""
printing.py — Service d'impression multi-plateforme.

Supporte :
  - Mode simulé (stub / mock) : journalise l'impression sans périphérique physique
  - Mode réel (Windows) : impression réelle via SumatraPDF CLI + pywin32
  - Mode réel (Unix)    : impression réelle via la commande CUPS standard (lp)
"""
import asyncio
import logging
import sys
import uuid
from pathlib import Path

from app.config import settings
from app.models.print_job import PrintJob

logger = logging.getLogger(__name__)


async def send_to_printer(job: PrintJob) -> bool:
    """
    Envoie un job d'impression à l'imprimante configurée ou par défaut.
    Ne lève jamais d'exception non gérée (renvoie False en cas d'échec).
    """
    if settings.PRINTING_MODE != "real":
        return await _stub_print(job)

    # Résolution de l'imprimante ciblée
    printer_name = await _resolve_printer_name(job.kiosk_id)
    if not printer_name:
        logger.error(
            f"[PRINT] Échec : Aucune imprimante disponible ou configurée "
            f"pour le job {job.id} (borne={job.kiosk_id})"
        )
        return False

    # Dispatch de l'impression selon le système d'exploitation
    if sys.platform == "win32":
        return await _windows_print(job, printer_name)
    else:
        return await _unix_print(job, printer_name)


async def list_available_printers() -> tuple[list[str], str | None]:
    """
    Liste les imprimantes locales disponibles selon l'OS courant.
    Retourne (liste_noms, imprimante_par_defaut).
    """
    if settings.PRINTING_MODE != "real":
        return (["Imprimante de test (stub)"], "Imprimante de test (stub)")

    if sys.platform == "win32":
        try:
            import win32print
            printers_raw = win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            )
            printer_names = [p[2] for p in printers_raw]
            default = win32print.GetDefaultPrinter()
            return (printer_names, default)
        except Exception as e:
            logger.error(f"Impossible de lister les imprimantes Windows : {e}")
            return ([], None)
    else:
        # UNIX (CUPS)
        try:
            import subprocess
            res = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, check=True)
            printer_names = []
            for line in res.stdout.splitlines():
                if line.startswith("printer "):
                    printer_names.append(line.split()[1])
            default = None
            try:
                res_def = subprocess.run(["lpstat", "-d"], capture_output=True, text=True, check=True)
                if ":" in res_def.stdout:
                    default = res_def.stdout.split(":")[-1].strip()
            except Exception:
                pass
            return (printer_names, default)
        except Exception as e:
            logger.error(f"Impossible de lister les imprimantes UNIX (CUPS) : {e}")
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
    # Simule le temps d'impression (~ 0.5 sec par page)
    await asyncio.sleep(min(job.pages * 0.5, 3))
    return True


# ── Mode réel Windows (SumatraPDF + pywin32) ──────────────────────────────────

async def _windows_print(job: PrintJob, printer_name: str) -> bool:
    """
    Impression réelle via SumatraPDF CLI sous Windows.
    """
    file_path = Path(job.file_path)
    ext = file_path.suffix.lower()

    # Conversion .docx → .pdf avant impression (SumatraPDF ne lit pas le DOCX)
    if ext == ".docx":
        converted = await _convert_docx_to_pdf_windows(file_path)
        if converted is None:
            logger.error(
                f"[PRINT] Impossible de convertir le fichier DOCX en PDF "
                f"(job={job.id}). Microsoft Word est-il installé ?"
            )
            return False
        file_path = converted
        ext = ".pdf"

    if ext not in (".pdf", ".jpg", ".jpeg", ".png"):
        logger.warning(
            f"[PRINT] Format de fichier '{ext}' non supporté pour l'impression "
            f"directe sans conversion (job={job.id})."
        )
        return False

    sumatra_settings = _build_sumatra_settings(job)

    # Résolution du chemin SumatraPDF en absolu (évite les problèmes de cwd)
    sumatra_path = Path(settings.SUMATRA_PATH)
    if not sumatra_path.is_absolute():
        # Remonte depuis app/services/ → app/ → backend/ puis ajoute bin/SumatraPDF.exe
        backend_dir = Path(__file__).parent.parent.parent
        sumatra_path = (backend_dir / sumatra_path).resolve()

    logger.info(
        f"[PRINT] SumatraPDF résolu : {sumatra_path} (existe={sumatra_path.exists()})"
    )

    cmd = [
        str(sumatra_path),
        "-print-to", printer_name,
        "-print-settings", sumatra_settings,
        "-silent",
        str(file_path.resolve()),
    ]

    logger.info(
        f"[PRINT] Impression Windows lancée — "
        f"job={job.id} | imprimante={printer_name} | options={sumatra_settings}"
    )

    import subprocess

    def _run_sumatra_sync() -> tuple[int, bytes, bytes]:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=60.0,
        )
        return result.returncode, result.stdout, result.stderr

    try:
        loop = asyncio.get_event_loop()
        returncode, stdout, stderr = await loop.run_in_executor(None, _run_sumatra_sync)

        if returncode != 0:
            logger.error(
                f"[PRINT] SumatraPDF erreur (code {returncode}) — "
                f"job={job.id} | stderr={stderr.decode(errors='replace')}"
            )
            return False

        logger.info(f"[PRINT] Job envoyé à l'imprimante Windows avec succès — job={job.id}")
        return True

    except subprocess.TimeoutExpired:
        logger.error(f"[PRINT] Timeout d'impression (60s expirées) — job={job.id}")
        return False
    except FileNotFoundError:
        logger.error(
            f"[PRINT] Exécutable SumatraPDF introuvable à l'adresse : {settings.SUMATRA_PATH}. "
            f"Veuillez le télécharger et le placer dans backend/bin/."
        )
        return False
    except Exception as e:
        logger.exception(f"[PRINT] Erreur inattendue lors de l'impression Windows (type={type(e).__name__})")
        return False


async def _convert_docx_to_pdf_windows(docx_path: Path) -> Path | None:
    """
    Convertit un fichier .docx en .pdf via Microsoft Word (win32com).
    Retourne le chemin du PDF généré, ou None en cas d'échec.
    Exécuté dans un thread séparé pour ne pas bloquer la boucle asyncio.
    """
    def _convert_sync() -> Path | None:
        try:
            import win32com.client
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            pdf_path = docx_path.with_suffix(".pdf")
            try:
                doc = word.Documents.Open(str(docx_path.resolve()))
                doc.SaveAs(str(pdf_path.resolve()), FileFormat=17)  # 17 = wdFormatPDF
                doc.Close(False)
                logger.info(f"[PRINT] DOCX converti en PDF : {pdf_path.name}")
                return pdf_path
            finally:
                word.Quit()
        except Exception as e:
            logger.error(f"[PRINT] Échec conversion DOCX→PDF via Word : {e}")
            return None

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _convert_sync)




async def _unix_print(job: PrintJob, printer_name: str) -> bool:
    """
    Impression réelle via commande lp de CUPS sous Linux / macOS.
    """
    file_path = Path(job.file_path)

    # Construction de la commande lp
    cmd = ["lp", "-d", printer_name, "-n", str(job.copies)]

    # Mode couleur ou monochrome
    if job.color_mode == "couleur":
        cmd.extend(["-o", "color-model=color"])
    else:
        cmd.extend(["-o", "color-model=monochrome"])

    # Recto-verso
    if job.duplex:
        cmd.extend(["-o", "sides=two-sided-long-edge"])
    else:
        cmd.extend(["-o", "sides=one-sided"])

    cmd.append(str(file_path))

    logger.info(
        f"[PRINT] Impression UNIX lancée — "
        f"job={job.id} | imprimante={printer_name} | cmd={' '.join(cmd)}"
    )

    import subprocess

    def _run_unix_sync() -> tuple[int, bytes, bytes]:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=45.0,
        )
        return result.returncode, result.stdout, result.stderr

    try:
        loop = asyncio.get_event_loop()
        returncode, stdout, stderr = await loop.run_in_executor(None, _run_unix_sync)

        if returncode != 0:
            logger.error(
                f"[PRINT] Erreur lp (code {returncode}) — "
                f"job={job.id} | stderr={stderr.decode(errors='replace')}"
            )
            return False

        logger.info(f"[PRINT] Job envoyé à CUPS avec succès — job={job.id}")
        return True

    except subprocess.TimeoutExpired:
        logger.error(f"[PRINT] Timeout d'impression UNIX — job={job.id}")
        return False
    except Exception as e:
        logger.error(f"[PRINT] Erreur lors de l'impression UNIX : {e}")
        return False


# ── Utilitaires ───────────────────────────────────────────────────────────────

async def _resolve_printer_name(kiosk_id: uuid.UUID) -> str | None:
    """
    Résout le nom de l'imprimante à utiliser en interrogeant la base de données.
    """
    # 1. Vérifie si une imprimante globale est forcée dans les configurations
    if settings.PRINTER_NAME:
        return settings.PRINTER_NAME

    # 2. Lit le printer_endpoint défini sur la borne (kiosk)
    try:
        from app.database import AsyncSessionLocal
        from app.models.kiosk import Kiosk
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Kiosk.printer_endpoint).where(Kiosk.id == kiosk_id)
            )
            printer_endpoint = result.scalar_one_or_none()
            if printer_endpoint:
                return printer_endpoint
    except Exception as e:
        logger.error(
            f"[PRINT] Erreur lors de la lecture du printer_endpoint "
            f"pour la borne {kiosk_id} : {e}"
        )

    # 3. Fallback sur l'imprimante par défaut du système d'exploitation
    if sys.platform == "win32":
        try:
            import win32print
            return win32print.GetDefaultPrinter()
        except Exception:
            return None
    else:
        try:
            import subprocess
            res = subprocess.run(["lpstat", "-d"], capture_output=True, text=True, check=True)
            if ":" in res.stdout:
                return res.stdout.split(":")[-1].strip()
        except Exception:
            pass
        return None


def _build_sumatra_settings(job: PrintJob) -> str:
    """
    Construit la chaîne d'options -print-settings pour SumatraPDF.
    """
    parts = [f"{job.copies}x"]
    parts.append("color" if job.color_mode == "couleur" else "monochrome")
    if job.duplex:
        parts.append("duplexlong")
    return ",".join(parts)
