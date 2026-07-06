"""
wia_scanner.py — Service d'acquisition scanner via WIA (Windows Image Acquisition).

Supporte deux modes, commutables via SCANNING_MODE dans .env :
  - "mock" : génère une image PNG de test sans scanner physique
  - "real" : acquisition réelle via win32com.client (pywin32 — déjà installé)

Le Canon G3030 est un scanner à plat sans ADF.
Chaque appel à scan_page() acquiert exactement UNE page.
La gestion du multi-pages (accumulation des PNG, assemblage final en PDF)
est entièrement à la charge de l'application (router scan.py).

Architecture :
  scan_page()          → point d'entrée public, dispatch mock/real
  _stub_scan()         → mode mock
  _wia_acquire()       → mode réel (délégue à _wia_acquire_sync() via thread)
  _wia_acquire_sync()  → appel COM synchrone (ne doit PAS être appelé depuis asyncio)
  _set_wia_property()  → helper pour écrire une propriété WIA par ID
  list_wia_devices()   → liste les scanners disponibles (diagnostic)
"""
import asyncio
import io
import logging
import uuid
from pathlib import Path

from app.config import settings
from app.exceptions import ScanAcquisitionError, ScannerNotFoundError

logger = logging.getLogger(__name__)

# ── Constantes WIA Property IDs ───────────────────────────────────────────────
# Source : Windows Image Acquisition Automation Layer (WIA 2.0)
_WIA_IPS_XRES       = 6147   # Résolution horizontale (DPI)
_WIA_IPS_YRES       = 6148   # Résolution verticale (DPI)
_WIA_IPA_DATATYPE   = 4103   # Type de données : 0=BW, 1=Grayscale, 2=Color
_WIA_IPS_CUR_INTENT = 6146   # Intention : 1=Color, 2=Grayscale/Text, 4=Text B&W

# GUID du format BMP WIA — format natif de transfert, converti en PNG ensuite
_WIA_FORMAT_BMP = "{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}"


# ── Point d'entrée public ─────────────────────────────────────────────────────

async def scan_page(
    scan_session_id: uuid.UUID,
    page_number: int,
    color_mode: str,
    resolution: int,
) -> str:
    """
    Acquiert une page depuis le scanner et sauvegarde le PNG sur disque.

    Args:
        scan_session_id : UUID de la ScanSession (détermine le répertoire)
        page_number     : numéro de la page (1-based), utilisé pour nommer le fichier
        color_mode      : "nb" (niveaux de gris) | "couleur" (RGB)
        resolution      : résolution en DPI (150 / 200 / 300)

    Returns:
        Chemin absolu du PNG sauvegardé.

    Raises:
        ScannerNotFoundError    : aucun scanner WIA disponible
        ScanAcquisitionError    : erreur pendant l'acquisition (timeout, matériel)
    """
    out_path = _build_page_path(scan_session_id, page_number)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if settings.SCANNING_MODE != "real":
        return await _stub_scan(out_path, page_number)

    return await _wia_acquire(out_path, color_mode, resolution)


async def list_wia_devices() -> list[str]:
    """
    Retourne la liste des scanners WIA disponibles (noms de périphériques).
    Utilisé par GET /scan/devices pour le diagnostic.
    """
    if settings.SCANNING_MODE != "real":
        return ["Scanner de test (stub)"]

    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, _list_wia_devices_sync)
    except Exception as e:
        logger.error(f"[WIA] Impossible de lister les périphériques : {e}")
        return []


# ── Mode stub (développement / test) ─────────────────────────────────────────

async def _stub_scan(out_path: Path, page_number: int) -> str:
    """
    Simule l'acquisition sans scanner physique.
    Génère une image PNG A4 @ 200 DPI avec le numéro de page.
    """
    from PIL import Image, ImageDraw

    logger.info(f"[STUB] Acquisition simulée — page {page_number} → {out_path.name}")

    # Simule le temps de chauffe + numérisation (~1.5s réaliste)
    await asyncio.sleep(1.5)

    # Image A4 à 200 DPI : 1654 × 2339 pixels
    img = Image.new("RGB", (1654, 2339), color=(250, 250, 250))
    draw = ImageDraw.Draw(img)

    # Texte centré indiquant le numéro de page
    text = f"PAGE {page_number}"
    draw.rectangle([200, 900, 1454, 1439], outline=(210, 210, 210), width=4)
    draw.text((827, 1169), text, fill=(160, 160, 160), anchor="mm")
    draw.text(
        (827, 2200),
        "Borne Multiservice — Scan simulé",
        fill=(200, 200, 200),
        anchor="mm",
    )

    img.save(str(out_path), "PNG", optimize=True)
    logger.info(f"[STUB] Page {page_number} sauvegardée : {out_path}")
    return str(out_path.resolve())


# ── Mode réel (WIA via win32com) ──────────────────────────────────────────────

async def _wia_acquire(out_path: Path, color_mode: str, resolution: int) -> str:
    """
    Déclenche une acquisition WIA réelle dans un thread séparé
    (win32com n'est pas thread-safe avec asyncio).
    """
    loop = asyncio.get_event_loop()

    try:
        result_path = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                _wia_acquire_sync,
                str(out_path),
                color_mode,
                resolution,
            ),
            timeout=float(settings.SCANNER_TIMEOUT_SECONDS),
        )
    except asyncio.TimeoutError:
        logger.error(
            f"[WIA] Timeout d'acquisition ({settings.SCANNER_TIMEOUT_SECONDS}s) "
            f"— scanner={settings.SCANNER_WIA_DEVICE_INDEX}"
        )
        raise ScanAcquisitionError(
            f"Le scanner n'a pas répondu dans les "
            f"{settings.SCANNER_TIMEOUT_SECONDS} secondes. "
            "Vérifiez que le document est bien posé sur la vitre."
        )
    except ScannerNotFoundError:
        raise
    except ScanAcquisitionError:
        raise
    except Exception as e:
        logger.exception(f"[WIA] Erreur inattendue lors de l'acquisition : {e}")
        raise ScanAcquisitionError(str(e))

    return result_path


def _wia_acquire_sync(out_path: str, color_mode: str, resolution: int) -> str:
    """
    Acquisition WIA synchrone — à appeler uniquement depuis run_in_executor.

    Séquence :
      1. Ouvre le Device Manager WIA
      2. Sélectionne le scanner par index (SCANNER_WIA_DEVICE_INDEX)
      3. Configure résolution + mode couleur via les propriétés WIA
      4. Transfère l'image (bloquant jusqu'à fin de scan)
      5. Convertit BMP → PNG via Pillow et sauvegarde sur disque
    """
    try:
        import win32com.client
    except ImportError:
        raise ScanAcquisitionError(
            "pywin32 non disponible. "
            "Passez en SCANNING_MODE=mock pour le développement."
        )

    # 1. Device Manager
    try:
        wia_manager = win32com.client.Dispatch("WIA.DeviceManager")
    except Exception as e:
        logger.error(f"[WIA] Impossible de démarrer WIA.DeviceManager : {e}")
        raise ScannerNotFoundError()

    # 2. Recherche du scanner (Type == 1 : WIA_DEVICE_TYPE_SCANNER)
    scanner_device = None
    device_index = settings.SCANNER_WIA_DEVICE_INDEX
    found_count = 0

    for i in range(wia_manager.DeviceInfos.Count):
        info = wia_manager.DeviceInfos.Item(i + 1)
        if info.Type == 1:  # Scanner
            if found_count == device_index:
                try:
                    scanner_device = info.Connect()
                    logger.info(f"[WIA] Scanner connecté : {info.DeviceID}")
                except Exception as e:
                    logger.error(f"[WIA] Échec de connexion au scanner : {e}")
                    raise ScannerNotFoundError()
                break
            found_count += 1

    if scanner_device is None:
        logger.error(
            f"[WIA] Aucun scanner trouvé à l'index {device_index}. "
            f"Périphériques WIA disponibles : {wia_manager.DeviceInfos.Count}"
        )
        raise ScannerNotFoundError()

    # 3. Scanner item (première source — flatbed)
    try:
        scanner_item = scanner_device.Items.Item(1)
    except Exception as e:
        logger.error(f"[WIA] Impossible d'accéder au scanner item : {e}")
        raise ScanAcquisitionError("Impossible d'accéder au capteur du scanner.")

    # 4. Configuration des propriétés WIA
    props = scanner_item.Properties
    _set_wia_property(props, _WIA_IPS_XRES, resolution)
    _set_wia_property(props, _WIA_IPS_YRES, resolution)

    if color_mode == "nb":
        # Niveaux de gris : meilleur rendu pour les documents texte, fichier plus léger
        _set_wia_property(props, _WIA_IPA_DATATYPE, 1)      # Grayscale
        _set_wia_property(props, _WIA_IPS_CUR_INTENT, 2)    # Text/Grayscale intent
    else:
        # Couleur RGB
        _set_wia_property(props, _WIA_IPA_DATATYPE, 2)      # Color
        _set_wia_property(props, _WIA_IPS_CUR_INTENT, 1)    # Color intent

    # 5. Transfert de l'image (bloquant jusqu'à fin d'acquisition)
    try:
        logger.info(
            f"[WIA] Démarrage acquisition — mode={color_mode} | "
            f"résolution={resolution} DPI"
        )
        image_file = scanner_item.Transfer(_WIA_FORMAT_BMP)
    except Exception as e:
        logger.error(f"[WIA] Erreur de transfert : {e}")
        raise ScanAcquisitionError(
            "Échec de l'acquisition. Le document est-il bien posé sur la vitre ?"
        )

    # 6. Conversion BMP → PNG et sauvegarde
    try:
        from PIL import Image

        raw_bytes = bytes(image_file.FileData.BinaryData)
        img = Image.open(io.BytesIO(raw_bytes))

        # Auto-contraste en mode niveaux de gris pour améliorer la lisibilité
        if color_mode == "nb":
            from PIL import ImageOps
            img = ImageOps.autocontrast(img.convert("L")).convert("RGB")

        img.save(out_path, "PNG", optimize=True)
        logger.info(f"[WIA] Page sauvegardée : {out_path} ({len(raw_bytes)} octets bruts)")

    except Exception as e:
        logger.exception(f"[WIA] Erreur lors de la conversion de l'image : {e}")
        raise ScanAcquisitionError("Erreur lors du traitement de l'image acquise.")

    return str(Path(out_path).resolve())


# ── Utilitaires ───────────────────────────────────────────────────────────────

def _set_wia_property(properties: object, prop_id: int, value: int) -> None:
    """
    Écrit une propriété WIA par son ID numérique.

    WIA expose les propriétés via une collection COM itérable.
    On ne peut pas accéder directement par ID → on itère jusqu'à trouver.
    Les propriétés manquantes (non supportées par le modèle) sont ignorées.
    """
    try:
        for i in range(properties.Count):
            prop = properties.Item(i + 1)
            if prop.PropertyID == prop_id:
                prop.Value = value
                return
        logger.debug(f"[WIA] Propriété {prop_id} non supportée par ce scanner — ignorée.")
    except Exception as e:
        logger.warning(f"[WIA] Impossible d'écrire la propriété {prop_id} : {e}")


def _list_wia_devices_sync() -> list[str]:
    """Liste les scanners WIA disponibles (synchrone)."""
    import win32com.client
    wia_manager = win32com.client.Dispatch("WIA.DeviceManager")
    devices = []
    for i in range(wia_manager.DeviceInfos.Count):
        info = wia_manager.DeviceInfos.Item(i + 1)
        if info.Type == 1:
            try:
                name = str(info.Properties.Item("Name").Value)
            except Exception:
                name = f"Scanner #{i}"
            devices.append(name)
    return devices


def _build_page_path(scan_session_id: uuid.UUID, page_number: int) -> Path:
    """
    Retourne le chemin du PNG pour une page donnée.
    Format : uploads/scan_{session_id}/page_001.png
    """
    return (
        Path(settings.UPLOAD_DIR)
        / f"scan_{scan_session_id}"
        / f"page_{page_number:03d}.png"
    )
