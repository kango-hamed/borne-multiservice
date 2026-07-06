import io
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kiosk import Kiosk
from app.models.session import Session
from app.models.print_job import PrintJob
from app.models.payment import Payment
from app.models.agent import Agent
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Seed de base pour les tests unitaires ─────────────────────────────────────

@pytest.fixture(autouse=True)
async def seed_test_data(db: AsyncSession):
    """Insère un kiosk et un agent par défaut dans la db SQLite de test s'ils n'existent pas."""
    # Vérifie si le kiosk existe déjà
    kiosk_id = uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6")
    existing_kiosk = await db.get(Kiosk, kiosk_id)
    if existing_kiosk is not None:
        return

    # Kiosk
    kiosk = Kiosk(
        id=kiosk_id,
        name="Borne Test Cocody",
        status="actif",
        printer_endpoint="HP Test Printer",
    )
    db.add(kiosk)

    # Agent
    agent = Agent(
        id=uuid.uuid4(),
        kiosk_id=kiosk.id,
        name="Agent Hamed Test",
        pin_hash=pwd_context.hash("1234"),
    )
    db.add(agent)
    await db.commit()


# ── Tests Endpoints ───────────────────────────────────────────────────────────

async def test_health_check(client: AsyncClient):
    """Vérifie l'endpoint /health."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


async def test_session_flow(client: AsyncClient):
    """Vérifie le cycle de vie d'une session (création et validation)."""
    # 1. Création session
    kiosk_id = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    response = await client.post("/sessions", json={"kiosk_id": kiosk_id})
    assert response.status_code == 201
    data = response.json()
    assert "session_token" in data
    assert data["kiosk_name"] == "Borne Test Cocody"
    assert data["status"] == "active"

    session_token = data["session_token"]

    # 2. Vérification statut session
    get_response = await client.get(f"/sessions/{session_token}")
    assert get_response.status_code == 200
    assert get_response.json()["is_valid"] is True


async def test_job_upload_and_config(client: AsyncClient, db: AsyncSession):
    """Vérifie l'upload d'un fichier et sa configuration."""
    # 1. Crée une session active
    kiosk_id = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    sess_resp = await client.post("/sessions", json={"kiosk_id": kiosk_id})
    session_token = sess_resp.json()["session_token"]

    # 2. Upload fichier (PDF simulé)
    file_content = b"%PDF-1.4 test pdf content"
    files = {"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")}
    data = {"session_token": session_token}

    upload_resp = await client.post("/jobs", data=data, files=files)
    assert upload_resp.status_code == 201
    job_data = upload_resp.json()
    assert "job_id" in job_data
    assert job_data["original_filename"] == "test.pdf"
    assert job_data["status"] == "en_creation"

    job_id = job_data["job_id"]

    # 3. Configuration de l'impression
    config_data = {
        "copies": 2,
        "color_mode": "nb",
        "duplex": True,
        "paper_format": "A4",
    }
    config_resp = await client.patch(f"/jobs/{job_id}/config", json=config_data)
    assert config_resp.status_code == 200
    config_res = config_resp.json()
    assert config_res["status"] == "attente_paiement"
    # Prix attendu : 2 copies, nb, duplex.
    # Dans pricing.py: nb_recto_verso = 80 FCFA/feuille.
    # 1 page en duplex = 1 feuille. 2 copies = 2 feuilles. Total = 160 FCFA.
    assert config_res["price_fcfa"] == 160


async def test_scan_document(client: AsyncClient, db: AsyncSession):
    """Scan matériel page par page (backend stub) : start → 2× page → finish."""
    kiosk_id = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    sess_resp = await client.post("/sessions", json={"kiosk_id": kiosk_id})
    session_token = sess_resp.json()["session_token"]

    # Ouverture de la session de scan (document en N&B)
    start_resp = await client.post(
        "/jobs/scan/start",
        data={"session_token": session_token, "grayscale": "true"},
    )
    assert start_resp.status_code == 201
    scan_id = start_resp.json()["scan_id"]
    assert start_resp.json()["pages"] == 0

    # Numérisation de 2 pages (le scanner stub renvoie une page synthétique)
    page1 = await client.post(f"/jobs/scan/{scan_id}/page")
    assert page1.status_code == 201
    assert page1.json()["page_number"] == 1
    assert page1.json()["pages"] == 1

    # La vignette de la page numérisée est disponible immédiatement
    page_preview = await client.get(f"/jobs/scan/{scan_id}/page/1/preview")
    assert page_preview.status_code == 200
    assert page_preview.headers["content-type"] == "image/png"

    page2 = await client.post(f"/jobs/scan/{scan_id}/page")
    assert page2.json()["pages"] == 2

    # Clôture : assemblage du PDF + création du job
    finish_resp = await client.post(f"/jobs/scan/{scan_id}/finish")
    assert finish_resp.status_code == 201
    job_data = finish_resp.json()
    assert job_data["pages"] == 2
    assert job_data["original_filename"] == "Document scanné.pdf"
    assert job_data["status"] == "en_creation"

    job_id = job_data["job_id"]

    # L'aperçu de la première page doit être disponible immédiatement
    preview_resp = await client.get(f"/jobs/{job_id}/preview")
    assert preview_resp.status_code == 200
    assert preview_resp.headers["content-type"] == "image/png"

    # Le document scanné suit le flux classique : configuration + prix
    config_resp = await client.patch(
        f"/jobs/{job_id}/config",
        json={"copies": 1, "color_mode": "nb", "duplex": False, "paper_format": "A4"},
    )
    assert config_resp.status_code == 200
    # 2 pages, 1 copie, N&B recto = 2 feuilles × 50 FCFA = 100 FCFA
    assert config_resp.json()["price_fcfa"] == 100


async def test_scan_finish_requires_page(client: AsyncClient):
    """Clôturer un scan sans aucune page numérisée doit échouer (422)."""
    kiosk_id = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    sess_resp = await client.post("/sessions", json={"kiosk_id": kiosk_id})
    session_token = sess_resp.json()["session_token"]

    start_resp = await client.post(
        "/jobs/scan/start",
        data={"session_token": session_token, "grayscale": "false"},
    )
    scan_id = start_resp.json()["scan_id"]

    finish_resp = await client.post(f"/jobs/scan/{scan_id}/finish")
    assert finish_resp.status_code == 422


async def test_scan_delete_page(client: AsyncClient):
    """La suppression d'une page mal numérisée réduit le compteur de pages."""
    kiosk_id = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    sess_resp = await client.post("/sessions", json={"kiosk_id": kiosk_id})
    session_token = sess_resp.json()["session_token"]

    start_resp = await client.post(
        "/jobs/scan/start",
        data={"session_token": session_token, "grayscale": "true"},
    )
    scan_id = start_resp.json()["scan_id"]

    await client.post(f"/jobs/scan/{scan_id}/page")
    await client.post(f"/jobs/scan/{scan_id}/page")

    del_resp = await client.delete(f"/jobs/scan/{scan_id}/page/1")
    assert del_resp.status_code == 200
    assert del_resp.json()["pages"] == 1

    # Supprimer une page inexistante renvoie 404
    del_missing = await client.delete(f"/jobs/scan/{scan_id}/page/99")
    assert del_missing.status_code == 404

    # Le document se clôture avec la page restante
    finish_resp = await client.post(f"/jobs/scan/{scan_id}/finish")
    assert finish_resp.status_code == 201
    assert finish_resp.json()["pages"] == 1


async def test_payment_and_admin_withdrawal(client: AsyncClient, db: AsyncSession):
    """Vérifie l'initiation du paiement, la simulation, et le retrait admin."""
    kiosk_id = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    
    # 1. Session + Job config
    sess_resp = await client.post("/sessions", json={"kiosk_id": kiosk_id})
    session_token = sess_resp.json()["session_token"]
    
    files = {"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}
    upload_resp = await client.post("/jobs", data={"session_token": session_token}, files=files)
    job_id = upload_resp.json()["job_id"]
    
    await client.patch(f"/jobs/{job_id}/config", json={"copies": 1, "color_mode": "nb", "duplex": False})

    # 2. Initie paiement (mock)
    pay_resp = await client.post(
        f"/payments/{job_id}/initiate",
        json={"provider": "mock", "phone_number": "0707070707"},
    )
    assert pay_resp.status_code == 201
    pay_data = pay_resp.json()
    assert pay_data["status"] == "en_attente"
    assert pay_data["provider"] == "mock"

    # Récupère le paiement en base pour choper l'ID de transaction
    pay_db_result = await db.execute(select(Payment).where(Payment.print_job_id == uuid.UUID(job_id)))
    payment_db = pay_db_result.scalar_one()
    txn_id = payment_db.provider_transaction_id

    # 3. Simule la confirmation du paiement via endpoint dev (forçage)
    force_resp = await client.post(f"/dev/payments/{txn_id}/force-success")
    assert force_resp.status_code == 200
    assert force_resp.json()["success"] is True

    # 4. Polling du statut du job
    # Devrait être passé à "paye" (ou "pret_a_retirer" si le worker de test a tourné,
    # mais sans le worker en tâche de fond active de test, il reste en "paye" car process_payment_confirmation met à "paye").
    # Forçons le passage en "pret_a_retirer" pour tester le retrait de l'agent.
    job_db_result = await db.execute(select(PrintJob).where(PrintJob.id == uuid.UUID(job_id)))
    job_db = job_db_result.scalar_one()
    assert job_db.status == "paye"
    assert job_db.withdrawal_code is not None
    code = job_db.withdrawal_code

    # On passe manuellement à "pret_a_retirer" pour tester l'endpoint de retrait
    job_db.status = "pret_a_retirer"
    await db.commit()

    # 5. Retrait Admin
    withdraw_data = {
        "withdrawal_code": code,
        "agent_pin": "1234",
    }
    withdraw_resp = await client.post(f"/admin/jobs/{job_id}/withdraw", json=withdraw_data)
    assert withdraw_resp.status_code == 200
    assert withdraw_resp.json()["status"] == "recupere"
