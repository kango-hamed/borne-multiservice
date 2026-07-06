"""
scanner.py — Service d'acquisition de pages depuis le scanner de la borne.

Contrairement à l'ancien scan « photo téléphone », les images ne viennent plus du
client : le backend, qui tourne sur l'hôte de la borne, pilote le scanner matériel
branché localement et acquiert les pages UNE PAR UNE.

Backends sélectionnés par settings.SCANNER_BACKEND (calqué sur printing.py) :
  - "stub"           : page synthétique (dev, sans matériel)
  - "wia"            : WIA / TWAIN sur Windows (pywin32)
  - "watched_folder" : scan-to-folder depuis le panneau de l'imprimante
  - "escl"           : imprimante réseau pilotée en HTTP (AirScan/Mopria)
"""
import asyncio
import io
import logging
import time
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw

from app.config import settings
from app.exceptions import ScannerUnavailableError, ScanTimeoutError

logger = logging.getLogger(__name__)

# Extensions considérées comme des images valides dans un dossier surveillé
_WATCHED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}

# Compteur de pages pour le stub (variété visuelle, non critique)
_stub_page_counter = 0


async def acquire_page(grayscale: bool = False) -> bytes:
    """
    Acquiert UNE page depuis le scanner et retourne ses octets bruts (image).

    Dispatch selon settings.SCANNER_BACKEND. Le paramètre `grayscale` est une
    intention documentaire : la conversion N&B définitive est appliquée à
    l'assemblage du PDF (voir pdf_utils._prepare_scanned_page). Les backends qui
    savent scanner directement en niveaux de gris l'exploitent (eSCL).

    Raises:
        ScannerUnavailableError: scanner absent / hors ligne / erreur de pilotage.
        ScanTimeoutError: aucune page reçue dans le délai imparti.
    """
    backend = settings.SCANNER_BACKEND

    if backend == "wia":
        return await _wia_acquire()
    if backend == "watched_folder":
        return await _watched_folder_acquire()
    if backend == "escl":
        return await _escl_acquire(grayscale)
    return await _stub_acquire(grayscale)


async def scanner_available() -> bool:
    """Indique si un scanner semble utilisable (diagnostic léger)."""
    backend = settings.SCANNER_BACKEND
    if backend == "stub":
        return True
    if backend == "watched_folder":
        return True  # le dossier est créé à la demande
    if backend == "wia":
        return await asyncio.to_thread(_wia_has_device)
    if backend == "escl":
        return bool(settings.SCANNER_ESCL_URL)
    return False


# ── Mode développement (stub) ─────────────────────────────────────────────────

async def _stub_acquire(grayscale: bool) -> bytes:
    """Simule une numérisation en produisant une page A4 synthétique."""
    global _stub_page_counter
    _stub_page_counter += 1
    page_no = _stub_page_counter

    # Simule le temps de passage du chariot du scanner
    await asyncio.sleep(1.2)

    data = await asyncio.to_thread(_render_stub_page, page_no)
    logger.info(f"[SCAN STUB] Page synthétique #{page_no} générée ({len(data)} octets)")
    return data


def _render_stub_page(page_no: int) -> bytes:
    """Génère une image de page façon document scanné (A4 à ~100 dpi)."""
    width, height = 827, 1169  # A4 @ ~100 dpi
    img = Image.new("RGB", (width, height), color=(250, 250, 248))
    draw = ImageDraw.Draw(img)

    margin = 90
    # En-tête
    draw.text((margin, 70), "DOCUMENT SCANNÉ — BORNE MULTISERVICE", fill=(30, 30, 30))
    draw.text(
        (margin, 100),
        f"Page {page_no}  ·  {datetime.now():%Y-%m-%d %H:%M:%S}",
        fill=(90, 90, 90),
    )
    draw.line([(margin, 130), (width - margin, 130)], fill=(180, 180, 180), width=2)

    # Corps : barres grises simulant des lignes de texte
    y = 180
    rng = (page_no * 2654435761) & 0xFFFFFFFF  # PRNG déterministe simple
    while y < height - margin:
        rng = (1103515245 * rng + 12345) & 0x7FFFFFFF
        line_w = int((width - 2 * margin) * (0.45 + (rng % 55) / 100))
        draw.rectangle([(margin, y), (margin + line_w, y + 12)], fill=(205, 205, 205))
        y += 34

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


# ── Mode production : WIA (Windows) ───────────────────────────────────────────

# Formats WIA (GUID) et identifiants de propriétés couramment utilisés
_WIA_FORMAT_JPEG = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"
_WIA_DEVICE_TYPE_SCANNER = 1
_WIA_PROP_HORIZONTAL_RES = 6147
_WIA_PROP_VERTICAL_RES = 6148


async def _wia_acquire() -> bytes:
    """Numérise via WIA. L'appel COM (bloquant) tourne dans un thread dédié."""
    try:
        return await asyncio.to_thread(_wia_acquire_sync)
    except ScannerUnavailableError:
        raise
    except Exception as e:  # pragma: no cover - dépend du matériel
        logger.error(f"[SCAN WIA] Échec de numérisation : {e}")
        raise ScannerUnavailableError()


def _wia_device_infos():  # pragma: no cover - dépend du matériel
    """Retourne (manager, DeviceInfos) WIA. COM doit être initialisé au préalable."""
    import win32com.client

    manager = win32com.client.Dispatch("WIA.DeviceManager")
    return manager, manager.DeviceInfos


def _wia_has_device() -> bool:  # pragma: no cover - dépend du matériel
    """Teste la présence d'au moins un scanner WIA."""
    import pythoncom

    pythoncom.CoInitialize()
    try:
        _, infos = _wia_device_infos()
        for i in range(1, infos.Count + 1):
            if infos.Item(i).Type == _WIA_DEVICE_TYPE_SCANNER:
                return True
        return False
    except Exception:
        return False
    finally:
        pythoncom.CoUninitialize()


def _wia_acquire_sync() -> bytes:  # pragma: no cover - dépend du matériel
    """Pilotage WIA synchrone : sélection du scanner → transfert JPEG."""
    import pythoncom

    pythoncom.CoInitialize()
    try:
        _, infos = _wia_device_infos()

        dev_info = None
        for i in range(1, infos.Count + 1):
            info = infos.Item(i)
            if info.Type != _WIA_DEVICE_TYPE_SCANNER:
                continue
            if not settings.SCANNER_NAME:
                dev_info = info
                break
            name = str(info.Properties("Name").Value)
            if settings.SCANNER_NAME.lower() in name.lower():
                dev_info = info
                break

        if dev_info is None:
            logger.error("[SCAN WIA] Aucun scanner détecté.")
            raise ScannerUnavailableError()

        device = dev_info.Connect()
        item = device.Items.Item(1)

        # Résolution de numérisation
        _set_wia_property(item.Properties, _WIA_PROP_HORIZONTAL_RES, settings.SCANNER_DPI)
        _set_wia_property(item.Properties, _WIA_PROP_VERTICAL_RES, settings.SCANNER_DPI)

        image = item.Transfer(_WIA_FORMAT_JPEG)
        return bytes(image.FileData.BinaryData)
    finally:
        pythoncom.CoUninitialize()


def _set_wia_property(properties, property_id: int, value) -> None:  # pragma: no cover
    """Affecte une propriété WIA par identifiant (silencieux si absente)."""
    try:
        for i in range(1, properties.Count + 1):
            prop = properties.Item(i)
            if prop.PropertyID == property_id:
                prop.Value = value
                return
    except Exception as e:
        logger.warning(f"[SCAN WIA] Propriété {property_id} non réglée : {e}")


# ── Mode production : dossier surveillé (scan-to-folder) ───────────────────────

async def _watched_folder_acquire() -> bytes:
    """
    Attend qu'un nouveau fichier image apparaisse dans SCAN_WATCH_DIR.

    L'usager lance la numérisation depuis le panneau de l'imprimante (fonction
    « scanner vers dossier »). On détecte le fichier déposé, on attend qu'il soit
    entièrement écrit (taille stable), on lit ses octets puis on le consomme.
    """
    watch_dir = Path(settings.SCAN_WATCH_DIR)
    watch_dir.mkdir(parents=True, exist_ok=True)

    before = _list_watch_images(watch_dir)
    deadline = time.monotonic() + settings.SCAN_WATCH_TIMEOUT_SECONDS

    logger.info(f"[SCAN FOLDER] En attente d'une page dans {watch_dir} …")

    while time.monotonic() < deadline:
        current = _list_watch_images(watch_dir)
        new_files = [p for p in current if p not in before]
        if new_files:
            # Le plus ancien fichier nouvellement apparu
            target = min(new_files, key=lambda p: p.stat().st_mtime)
            data = await asyncio.to_thread(_read_when_stable, target)
            if data is not None:
                try:
                    target.unlink()
                except OSError:
                    pass
                logger.info(f"[SCAN FOLDER] Page récupérée : {target.name} ({len(data)} octets)")
                return data
        await asyncio.sleep(1.0)

    logger.error("[SCAN FOLDER] Délai dépassé sans fichier reçu.")
    raise ScanTimeoutError()


def _list_watch_images(watch_dir: Path) -> set[Path]:
    return {
        p for p in watch_dir.iterdir()
        if p.is_file() and p.suffix.lower() in _WATCHED_IMAGE_EXTS
    }


def _read_when_stable(path: Path, checks: int = 3, interval: float = 0.4) -> bytes | None:
    """Lit un fichier une fois sa taille stabilisée (fin d'écriture par le MFP)."""
    last = -1
    for _ in range(checks):
        try:
            size = path.stat().st_size
        except OSError:
            return None
        if size == last and size > 0:
            try:
                return path.read_bytes()
            except OSError:
                return None
        last = size
        time.sleep(interval)
    # Dernière tentative après la boucle
    try:
        return path.read_bytes() or None
    except OSError:
        return None


# ── Mode production : eSCL (scan réseau HTTP) ─────────────────────────────────

async def _escl_acquire(grayscale: bool) -> bytes:
    """
    Numérise via le protocole eSCL (AirScan / Mopria) sur une imprimante réseau.

    Séquence : POST /eSCL/ScanJobs (crée le job) → GET <job>/NextDocument (image).
    """
    base = settings.SCANNER_ESCL_URL.rstrip("/")
    if not base:
        logger.error("[SCAN eSCL] SCANNER_ESCL_URL non configurée.")
        raise ScannerUnavailableError()

    import httpx

    color_mode = "Grayscale8" if grayscale else "RGB24"
    scan_settings = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<scan:ScanSettings xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" '
        'xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">'
        "<pwg:Version>2.6</pwg:Version>"
        "<scan:Intent>Document</scan:Intent>"
        "<pwg:InputSource>Platen</pwg:InputSource>"
        f"<scan:ColorMode>{color_mode}</scan:ColorMode>"
        "<pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat>"
        f"<scan:XResolution>{settings.SCANNER_DPI}</scan:XResolution>"
        f"<scan:YResolution>{settings.SCANNER_DPI}</scan:YResolution>"
        "</scan:ScanSettings>"
    )

    timeout = httpx.Timeout(settings.SCAN_WATCH_TIMEOUT_SECONDS)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            create = await client.post(
                f"{base}/eSCL/ScanJobs",
                content=scan_settings,
                headers={"Content-Type": "text/xml"},
            )
            if create.status_code not in (201, 200):
                logger.error(f"[SCAN eSCL] Création du job refusée ({create.status_code}).")
                raise ScannerUnavailableError()

            job_url = create.headers.get("Location")
            if not job_url:
                logger.error("[SCAN eSCL] En-tête Location absent de la réponse.")
                raise ScannerUnavailableError()
            if job_url.startswith("/"):
                job_url = f"{base}{job_url}"

            doc = await client.get(f"{job_url.rstrip('/')}/NextDocument")
            if doc.status_code != 200 or not doc.content:
                logger.error(f"[SCAN eSCL] Récupération de la page échouée ({doc.status_code}).")
                raise ScanTimeoutError()

            logger.info(f"[SCAN eSCL] Page récupérée ({len(doc.content)} octets)")
            return doc.content
    except (ScannerUnavailableError, ScanTimeoutError):
        raise
    except httpx.TimeoutException:
        logger.error("[SCAN eSCL] Délai dépassé.")
        raise ScanTimeoutError()
    except Exception as e:
        logger.error(f"[SCAN eSCL] Erreur inattendue : {e}")
        raise ScannerUnavailableError()
