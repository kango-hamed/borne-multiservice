"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";
import { api } from "@/lib/api";

const MAX_PAGES = 30;

interface ScanPage {
  pageNumber: number; // identifiant serveur (jamais réutilisé dans la session)
}

export default function ScanPage() {
  const router = useRouter();
  const { sessionToken, setJob } = useSession();

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
    setError(null);

    try {
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
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Scanner un document" step={1} />

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
          </div>
        )}

        {pages.length > 0 && (
          <p className="text-xs text-neutral-dark/40 text-center -mt-2">
            {pages.length} page{pages.length > 1 ? "s" : ""}
            {grayscale ? " · noir & blanc" : " · couleur"}
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
            ⚠️ {error}
          </div>
        )}

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
      </div>
    </div>
  );
}
