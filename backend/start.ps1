# Script de démarrage rapide — installe les dépendances et lance le serveur
# Usage : .\start.ps1

Write-Host "=== Borne Multiservice — Backend ===" -ForegroundColor Cyan

# Détection automatique de la version Python 3.11 sur Windows
$pythonPath = "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\python.exe"

# Vérification et création du venv
if (-not (Test-Path ".\.venv")) {
    Write-Host "Venv non trouvé. Création avec Python 3.11..." -ForegroundColor Yellow
    if (Test-Path $pythonPath) {
        & $pythonPath -m venv .venv
        Write-Host "Venv créé avec succès." -ForegroundColor Green
    } else {
        Write-Host "ERREUR : Python 3.11 est introuvable à l'adresse : $pythonPath" -ForegroundColor Red
        Exit
    }
}

# Utilisation directe des exécutables du venv (évite les bugs d'activation sous PowerShell)
$venvPip = ".\.venv\Scripts\pip.exe"
$venvUvicorn = ".\.venv\Scripts\uvicorn.exe"
$venvPython = ".\.venv\Scripts\python.exe"

# Installation des dépendances
Write-Host "Installation des dépendances..." -ForegroundColor Yellow
& $venvPip install -r requirements.txt -q

# Copie du .env si absent
if (-not (Test-Path ".\.env")) {
    if (Test-Path ".\.env.example") {
        Copy-Item ".\.env.example" ".\.env"
        Write-Host "Fichier .env créé depuis .env.example. Pensez à le configurer !" -ForegroundColor Yellow
    } else {
        Write-Host "AVERTISSEMENT : .env absent et .env.example introuvable." -ForegroundColor Red
    }
}

# Vérification SumatraPDF
if (-not (Test-Path ".\bin\SumatraPDF.exe")) {
    Write-Host "ATTENTION : SumatraPDF.exe absent de .\bin\" -ForegroundColor Red
    Write-Host "Téléchargez-le depuis : https://www.sumatrapdfreader.org/download-free-pdf-viewer" -ForegroundColor Red
    Write-Host "(Requis uniquement en mode ENVIRONMENT=production)" -ForegroundColor Gray
}

# Lancement des migrations de la base de données
Write-Host "Application des migrations de la base de données..." -ForegroundColor Yellow
$venvAlembic = ".\.venv\Scripts\alembic.exe"
if (Test-Path $venvAlembic) {
    & $venvAlembic upgrade head
} else {
    Write-Host "AVERTISSEMENT : alembic introuvable, les migrations n'ont pas été appliquées." -ForegroundColor Red
}

# Exécution du seed afin d'avoir des données de test
Write-Host "Exécution et remplissage de données" -ForegroundColor Yellow
& $venvPython -m app.seed

# Lancement du serveur
Write-Host "Démarrage de l'API..." -ForegroundColor Green
& $venvUvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
