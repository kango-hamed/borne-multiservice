"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
<<<<<<< HEAD
import { api, ScannedPage } from "@/lib/api";
=======
import { api } from "@/lib/api";
>>>>>>> 11a7742272bcc674ea84898105eeb599d631f1f4

// ── Icônes ─────────────────────────────────────────────────────────────────────

<<<<<<< HEAD
function ScanIcon() {
  return (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18H4a2 2 0 01-2-2V8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2h-2" />
      <path d="M6 9h12" />
      <rect x="8" y="14" width="8" height="8" rx="1" />
    </svg>
  );
=======
interface ScanPage {
  pageNumber: number; // identifiant serveur (jamais réutilisé dans la session)
>>>>>>> 11a7742272bcc674ea84898105eeb599d631f1f4
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

<<<<<<< HEAD
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
=======
  const [scanId, setScanId] = useState<string | null>(null);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [grayscale, setGrayscale] = useState(true);
  const [scanning, setScanning] = useState(false); // numérisation d'une page en cours
  const [finishing, setFinishing] = useState(false); // assemblage final en cours
  const [error, setError] = useState<string | null>(null);

  // Suivi pour le nettoyage au démontage : on annule la session de scan si elle
  // n'a pas été clôturée par « Terminer ».
  const scanIdRef = useRef<string | null>(null);
  const finalizedRef = useRef(false);
  useEffect(() => {
    scanIdRef.current = scanId;
  }, [scanId]);
  useEffect(() => {
    return () => {
      if (scanIdRef.current && !finalizedRef.current) {
        api.scanCancel(scanIdRef.current);
      }
    };
  }, []);

  const busy = scanning || finishing;

  // Numérise une page : ouvre la session au premier appel, puis ajoute la page.
  const scanNextPage = useCallback(async () => {
    if (busy) return;

    if (!sessionToken) {
      setError("Session expirée ou invalide. Veuillez rescanner le QR code.");
      return;
    }
    if (pages.length >= MAX_PAGES) {
      setError(`Maximum ${MAX_PAGES} pages par document.`);
      return;
    }

    setScanning(true);
>>>>>>> 11a7742272bcc674ea84898105eeb599d631f1f4
    setError(null);
    setScanning(true);
    try {
<<<<<<< HEAD
      const sessionData = await api.createScanSession(kioskId, colorMode, 200);
      setScanSessionId(sessionData.scan_session_id);
      setPhase("scanning");
      await acquirePage(sessionData.scan_session_id);
    } catch (err: any) {
      setError(err.message || "Impossible de démarrer le scanner.");
    } finally {
      setScanning(false);
=======
      let id = scanId;
      if (!id) {
        const started = await api.scanStart(sessionToken, grayscale);
        id = started.scan_id;
        setScanId(id);
      }

      const page = await api.scanPage(id);
      setPages((prev) => [...prev, { pageNumber: page.page_number }]);
    } catch (err: any) {
      setError(err.message || "La numérisation a échoué. Réessayez.");
    } finally {
      setScanning(false);
    }
  }, [busy, sessionToken, pages.length, scanId, grayscale]);

  const removePage = async (pageNumber: number) => {
    if (busy || !scanId) return;
    // Optimiste : retire immédiatement, restaure en cas d'échec
    const snapshot = pages;
    setPages((prev) => prev.filter((p) => p.pageNumber !== pageNumber));
    try {
      await api.scanDeletePage(scanId, pageNumber);
    } catch {
      setPages(snapshot);
      setError("Impossible de supprimer cette page. Réessayez.");
    }
  };

  const handleFinish = async () => {
    if (busy || !scanId || pages.length === 0) return;

    setFinishing(true);
    setError(null);

    try {
      const data = await api.scanFinish(scanId);
      finalizedRef.current = true; // clôturée : pas d'annulation au démontage
      setJob(data.job_id, data.original_filename, data.pages, data.preview_url);
      router.push("/flow/config");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la finalisation du document.");
      setFinishing(false);
>>>>>>> 11a7742272bcc674ea84898105eeb599d631f1f4
    }
  };

  // ── Acquisition d'une page ────────────────────────────────────────────────

<<<<<<< HEAD
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
=======
      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {/* Consigne matériel */}
        <div className="bg-accent/10 border border-accent/40 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl leading-none">🖨️</span>
          <div>
            <p className="font-semibold text-primary">Scanner de la borne</p>
            <p className="text-xs text-neutral-dark/60 mt-0.5">
              Posez une page sur la vitre du scanner, puis appuyez sur « Scanner ».
              Répétez pour chaque page, puis appuyez sur « Terminer ».
            </p>
          </div>
        </div>

        {pages.length === 0 ? (
          /* ── État initial : aucune page encore numérisée ── */
          <>
            {/* Optimisation N&B (modifiable avant la 1ʳᵉ page seulement) */}
            <div className="bg-white rounded-2xl p-4 border border-accent/30">
              <div className="flex items-center justify-between">
                <div className="pr-3">
                  <p className="font-semibold text-neutral-dark">Optimiser pour le texte</p>
                  <p className="text-xs text-neutral-dark/50 mt-0.5">
                    Noir &amp; blanc plus net, fichier plus léger
                  </p>
                </div>
                <button
                  onClick={() => setGrayscale(!grayscale)}
                  disabled={busy}
                  aria-label="Optimiser pour le texte"
                  className={`relative w-14 h-7 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50
                    ${grayscale ? "bg-success" : "bg-neutral-dark/15"}`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-200
                    ${grayscale ? "translate-x-7" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>

            <div className="border-2 border-dashed border-accent rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center min-h-48 bg-white">
              <div className="w-16 h-16 rounded-2xl bg-accent/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                </svg>
              </div>
              <p className="text-sm text-neutral-dark/60">
                Aucune page numérisée pour l'instant.
              </p>
            </div>
          </>
        ) : (
          /* ── Grille des pages numérisées ── */
          <div className="grid grid-cols-2 gap-3">
            {pages.map((page, index) => (
              <div
                key={page.pageNumber}
                className="relative rounded-xl overflow-hidden border border-accent/40 bg-white shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scanId ? api.scanPagePreviewUrl(scanId, page.pageNumber) : ""}
                  alt={`Page ${index + 1}`}
                  className="w-full h-40 object-cover bg-neutral-light"
                />
                <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow">
                  {index + 1}
                </span>
                <button
                  onClick={() => removePage(page.pageNumber)}
                  disabled={busy}
                  aria-label={`Supprimer la page ${index + 1}`}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 text-red-600 flex items-center justify-center shadow active:scale-90 transition-transform disabled:opacity-40"
                >
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Tuile « scan en cours » pendant la numérisation d'une nouvelle page */}
            {scanning && (
              <div className="rounded-xl border border-accent/40 bg-accent/10 h-40 flex flex-col items-center justify-center gap-2 text-primary">
                <svg className="w-7 h-7 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-semibold">Scan en cours…</span>
              </div>
            )}
>>>>>>> 11a7742272bcc674ea84898105eeb599d631f1f4
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

        {pages.length > 0 && (
          <p className="text-xs text-neutral-dark/40 text-center -mt-2">
            {pages.length} page{pages.length > 1 ? "s" : ""}
            {grayscale ? " · noir & blanc" : " · couleur"}
          </p>
        )}

        {error && (
          <div style={{ margin: "0 18px", padding: "10px 14px", borderRadius: 10, background: "#FFF0F0", border: "1px solid #FFCDD2", fontSize: 12, color: "#C62828", fontWeight: 500, flexShrink: 0 }}>
            ⚠️ {error}
          </div>
        )}

<<<<<<< HEAD
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
=======
        {/* ── Actions ── */}
        <div className="mt-auto flex flex-col gap-3">
          {/* Scanner / Continuer */}
          <button
            suppressHydrationWarning
            onClick={scanNextPage}
            disabled={busy || pages.length >= MAX_PAGES}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200
              ${!busy && pages.length < MAX_PAGES
                ? "bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98]"
                : "bg-neutral-dark/10 text-neutral-dark/30 cursor-not-allowed"
              }`}
          >
            {scanning ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scan en cours…
              </span>
            ) : pages.length === 0 ? (
              "Scanner la page"
            ) : pages.length >= MAX_PAGES ? (
              `Maximum ${MAX_PAGES} pages atteint`
            ) : (
              "Continuer — scanner une autre page"
            )}
          </button>

          {/* Terminer */}
          {pages.length > 0 && (
            <button
              onClick={handleFinish}
              disabled={busy}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200
                ${!busy
                  ? "bg-success text-white shadow-lg shadow-success/30 active:scale-[0.98]"
                  : "bg-neutral-dark/10 text-neutral-dark/30 cursor-not-allowed"
                }`}
            >
              {finishing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Assemblage…
                </span>
              ) : (
                `Terminer avec ${pages.length} page${pages.length > 1 ? "s" : ""} →`
              )}
            </button>
          )}
        </div>
>>>>>>> 11a7742272bcc674ea84898105eeb599d631f1f4
      </div>
    </div>
  );
}
