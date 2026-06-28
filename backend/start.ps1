# Script de démarrage rapide — installe les dépendances et lance le serveur
# Usage : .\start.ps1

Write-Host "=== Borne Multiservice — Backend ===" -ForegroundColor Cyan

# Activation du venv
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    . .\.venv\Scripts\Activate.ps1
    Write-Host "Venv activé." -ForegroundColor Green
} else {
    Write-Host "Venv non trouvé. Création..." -ForegroundColor Yellow
    python -m venv .venv
    . .\.venv\Scripts\Activate.ps1
}

# Installation des dépendances
Write-Host "Installation des dépendances..." -ForegroundColor Yellow
pip install -r requirements.txt -q

# Copie du .env si absent
if (-not (Test-Path ".\.env")) {
    Copy-Item ".\.env.example" ".\.env"
    Write-Host "Fichier .env créé depuis .env.example. Pensez à le configurer !" -ForegroundColor Yellow
}

# Vérification SumatraPDF
if (-not (Test-Path ".\bin\SumatraPDF.exe")) {
    Write-Host "ATTENTION : SumatraPDF.exe absent de .\bin\" -ForegroundColor Red
    Write-Host "Téléchargez-le depuis : https://www.sumatrapdfreader.org/download-free-pdf-viewer" -ForegroundColor Red
    Write-Host "(Requis uniquement en mode ENVIRONMENT=production)" -ForegroundColor Gray
}

# Lancement du serveur
Write-Host "Démarrage de l'API..." -ForegroundColor Green
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
