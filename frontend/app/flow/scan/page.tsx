"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { api, ScannedPage } from "@/lib/api";

// ── Icônes ─────────────────────────────────────────────────────────────────────

function ScanIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18H4a2 2 0 01-2-2V8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2h-2" />
      <path d="M6 9h12" />
      <rect x="8" y="14" width="8" height="8" rx="1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

// ── Composant header ──────────────────────────────────────────────────────────

function FlowHeader({ title, step, total, onBack }: { title: string; step: number; total: number; onBack?: () => void }) {
  return (
    <div style={{ background: "#1E2258", padding: "20px 18px 16px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#FFFFFF", flexShrink: 0 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(184,188,224,0.65)", fontWeight: 500 }}>
            Étape {step}/{total}
          </p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{title}</p>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ width: 20, height: 3, borderRadius: 2, background: i < step ? "#16A38A" : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "settings" | "scanning" | "done";

// ── Page principale ────────────────────────────────────────────────────────────

export default function ScanDocumentPage() {
  const router = useRouter();
  const { kioskId: ctxKioskId, clearSession, setServiceType, setJob, updateJobConfig } = useSession();

  const kioskId = ctxKioskId || (typeof window !== "undefined" ? localStorage.getItem("kiosk_id") : null);

  const handleNew = () => {
    clearSession();
    if (kioskId) {
      router.replace(`/?kiosk=${kioskId}`);
    } else {
      router.replace("/");
    }
  };

  const handleHome = () => {
    clearSession();
    router.replace("/");
  };

  // Configuration
  const [colorMode, setColorMode] = useState<"nb" | "couleur">("nb");

  // Session de scan
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // États UI
  const [phase, setPhase] = useState<Phase>("settings");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Démarrage ─────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!kioskId) {
      setError("Identifiant de borne introuvable.");
      return;
    }
    setError(null);
    setScanning(true);
    try {
      const sessionData = await api.createScanSession(kioskId, colorMode, 200);
      setScanSessionId(sessionData.scan_session_id);
      setPhase("scanning");
      await acquirePage(sessionData.scan_session_id);
    } catch (err: any) {
      setError(err.message || "Impossible de démarrer le scanner.");
    } finally {
      setScanning(false);
    }
  };

  // ── Acquisition d'une page ────────────────────────────────────────────────

  const acquirePage = async (sid?: string) => {
    const id = sid ?? scanSessionId;
    if (!id) return;
    setScanning(true);
    setError(null);
    try {
      const data = await api.acquireScanPage(id);
      const newPage: ScannedPage = {
        page_number: data.page_number,
        preview_url: api.getScanPagePreviewUrl(id, data.page_number),
      };
      setScannedPages((prev) => [...prev, newPage]);
    } catch (err: any) {
      setError(err.message || "Erreur d'acquisition. Vérifiez le scanner.");
    } finally {
      setScanning(false);
    }
  };

  // ── Suppression de la dernière page ───────────────────────────────────────

  const handleDeleteLast = async () => {
    if (!scanSessionId || scannedPages.length === 0) return;
    const last = scannedPages[scannedPages.length - 1];
    try {
      await api.deleteScanPage(scanSessionId, last.page_number);
      setScannedPages((prev) => prev.slice(0, -1));
    } catch (err: any) {
      setError(err.message || "Impossible de supprimer la page.");
    }
  };

  // ── Finalisation → génère le PDF ─────────────────────────────────────────

  const handleFinalize = async () => {
    if (!scanSessionId || scannedPages.length === 0) return;
    setScanning(true);
    setError(null);
    try {
      const data = await api.finalizeScanSession(scanSessionId);
      setServiceType("scan");
      setJob(data.print_job_id, "Scan.pdf", data.pages, api.getPreviewUrl(data.print_job_id));
      const price = (colorMode === "couleur" ? 75 : 25) * data.pages;
      updateJobConfig({
        colorMode: colorMode,
        price: price,
      });
      router.push("/flow/price");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la génération du PDF.");
    } finally {
      setScanning(false);
    }
  };

  // ── Annulation ────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (scanSessionId) {
      try { await api.cancelScanSession(scanSessionId); } catch (_) { /* silencieux */ }
    }
    router.push("/");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE : RÉGLAGES
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === "settings") {
    return (
      <div style={{ height: "100dvh", background: "#F5F6FA", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-sans, sans-serif)" }}>
        <FlowHeader title="Scan de document" step={1} total={3} onBack={handleCancel} />

        <div style={{ flex: 1, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>

          {/* Illustration */}
          <div style={{ background: "#FFFFFF", border: "0.5px solid #D8DBEE", borderRadius: 14, padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", flex: 1, justifyContent: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: "#EEF0FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#3D3F7A" }}>
              <ScanIcon />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1B1B2E" }}>Posez votre document</p>
              <p style={{ marginTop: 6, marginBottom: 0, marginLeft: "auto", marginRight: "auto", fontSize: 12, color: "#6B6E8C", lineHeight: 1.5, maxWidth: 220 }}>
                Placez votre document face vers le bas sur la vitre du scanner, refermez le capot, puis appuyez sur Scanner.
              </p>
            </div>
            {/* Résultat attendu */}
            <div style={{ background: "#EEF0FF", borderRadius: 10, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📄</span>
              <span style={{ fontSize: 11, color: "#3D3F7A", fontWeight: 600 }}>Vous recevrez un lien de téléchargement PDF</span>
            </div>
          </div>

          {/* Sélection couleur */}
          <div style={{ background: "#FFFFFF", border: "0.5px solid #D8DBEE", borderRadius: 14, padding: "16px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9B9DB8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Qualité du scan</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["nb", "couleur"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  style={{
                    padding: "12px 0",
                    borderRadius: 10,
                    border: colorMode === mode ? "2px solid #3D3F7A" : "1.5px solid #D8DBEE",
                    background: colorMode === mode ? "#EEF0FF" : "#FFFFFF",
                    color: colorMode === mode ? "#1E2258" : "#6B6E8C",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{mode === "nb" ? "⬛" : "🎨"}</span>
                  {mode === "nb" ? "Noir & Blanc" : "Couleur"}
                </button>
              ))}
            </div>
          </div>

          {/* Tarif */}
          <div style={{ background: "#F5F6FA", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, border: "0.5px solid #D8DBEE" }}>
            <span style={{ fontSize: 13 }}>💡</span>
            <p style={{ margin: 0, fontSize: 11, color: "#6B6E8C", lineHeight: 1.4 }}>
              Scan N&B : 25 FCFA/page • Scan couleur : 75 FCFA/page
            </p>
          </div>
        </div>

        {error && (
          <div style={{ margin: "0 18px", padding: "10px 14px", borderRadius: 10, background: "#FFF0F0", border: "1px solid #FFCDD2", fontSize: 12, color: "#C62828", fontWeight: 500, flexShrink: 0 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ padding: "12px 18px 28px", flexShrink: 0 }}>
          <button
            onClick={handleStart}
            disabled={scanning}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 14,
              border: "none",
              background: scanning ? "#B8BCE0" : "#1E2258",
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              cursor: scanning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {scanning ? (
              <>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="#FFFFFF" />
                </svg>
                Démarrage…
              </>
            ) : (
              <>
                <ScanIcon />
                Lancer le scan →
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE : NUMÉRISATION
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === "scanning") {
    return (
      <div style={{ height: "100dvh", background: "#F5F6FA", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-sans, sans-serif)" }}>
        <FlowHeader title="Numérisation" step={2} total={3} />

        <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>

          {scannedPages.length > 0 ? (
            <div style={{ background: "#FFFFFF", border: "0.5px solid #D8DBEE", borderRadius: 14, padding: "14px", flex: 1, display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#9B9DB8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Pages numérisées — {scannedPages.length}
                </p>
                <button
                  onClick={handleDeleteLast}
                  style={{ background: "#FFF0F0", border: "none", borderRadius: 8, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#C62828", fontSize: 11, fontWeight: 600 }}
                >
                  <TrashIcon />
                  Supprimer la dernière
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {scannedPages.map((page, i) => (
                  <div key={page.page_number} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #D8DBEE", aspectRatio: "3/4", background: "#F5F6FA" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page.preview_url} alt={`Page ${page.page_number}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <span style={{ position: "absolute", top: 4, left: 4, width: 20, height: 20, borderRadius: "50%", background: "#1E2258", color: "#FFFFFF", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {i + 1}
                    </span>
                    {i === scannedPages.length - 1 && (
                      <span style={{ position: "absolute", bottom: 4, right: 4, background: "#16A38A", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, background: "#FFFFFF", border: "0.5px solid #D8DBEE", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: 24 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "#EEF0FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#1E2258" }}>
                <ScanIcon />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1B1B2E" }}>Scanner prêt</p>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6B6E8C", lineHeight: 1.5 }}>
                  Appuyez sur le bouton ci-dessous pour numériser la première page.
                </p>
              </div>
            </div>
          )}

          {/* Bouton scan page suivante */}
          <button
            onClick={() => acquirePage()}
            disabled={scanning}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 14,
              border: scanning ? "none" : "2px dashed #1E2258",
              background: scanning ? "#EEF0FF" : "#FFFFFF",
              color: scanning ? "#6B6E8C" : "#1E2258",
              fontSize: 14,
              fontWeight: 700,
              cursor: scanning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {scanning ? (
              <>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(30,34,88,0.25)" strokeWidth="4" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="#1E2258" />
                </svg>
                Numérisation en cours…
              </>
            ) : (
              <>
                <ScanIcon />
                Scanner la page {scannedPages.length + 1}
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{ margin: "0 18px", padding: "10px 14px", borderRadius: 10, background: "#FFF0F0", border: "1px solid #FFCDD2", fontSize: 12, color: "#C62828", fontWeight: 500, flexShrink: 0 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ padding: "10px 18px 28px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={handleFinalize}
            disabled={scannedPages.length === 0 || scanning}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 14,
              border: "none",
              background: scannedPages.length > 0 && !scanning ? "#1E2258" : "#D8DBEE",
              color: scannedPages.length > 0 && !scanning ? "#FFFFFF" : "#9B9DB8",
              fontSize: 15,
              fontWeight: 700,
              cursor: scannedPages.length > 0 && !scanning ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.2s",
            }}
          >
            <DownloadIcon />
            Générer le PDF ({scannedPages.length} page{scannedPages.length > 1 ? "s" : ""}) →
          </button>
          <button
            onClick={handleCancel}
            style={{ background: "none", border: "none", fontSize: 12, color: "#9B9DB8", fontWeight: 600, cursor: "pointer", padding: "4px 0" }}
          >
            Annuler et retourner à l'accueil
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE : PDF PRÊT — TÉLÉCHARGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: "100dvh", background: "#F5F6FA", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-sans, sans-serif)" }}>
      <FlowHeader title="PDF prêt !" step={3} total={3} />

      <div style={{ flex: 1, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center", textAlign: "center" }}>

        {/* Succès */}
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "#EAF7F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#16A38A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1B1B2E" }}>Votre document est prêt</p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6B6E8C", lineHeight: 1.5 }}>
            {scannedPages.length} page{scannedPages.length > 1 ? "s" : ""} numérisée{scannedPages.length > 1 ? "s" : ""} — cliquez ci-dessous pour télécharger le PDF.
          </p>
        </div>

        {/* Bouton téléchargement */}
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download="scan.pdf"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              maxWidth: 300,
              padding: "16px",
              borderRadius: 14,
              background: "#16A38A",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            <DownloadIcon />
            Télécharger le PDF
          </a>
        )}

        {/* Info */}
        <p style={{ margin: 0, fontSize: 11, color: "#B8BCE0", maxWidth: 240, lineHeight: 1.5 }}>
          Le lien est valable pendant 24h. Partagez-le ou ouvrez-le directement depuis votre téléphone.
        </p>
      </div>

      <div style={{ padding: "12px 18px 28px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={handleNew}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            border: "none",
            background: "#1E2258",
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Nouveau scan
        </button>
        <button
          onClick={handleHome}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "1.5px solid #D8DBEE",
            background: "#FFFFFF",
            color: "#6B6E8C",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Page d'accueil
        </button>
      </div>
    </div>
  );
}
