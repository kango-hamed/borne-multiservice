"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";
import { api } from "@/lib/api";

type ColorMode = "nb" | "couleur";

export default function ConfigPage() {
  const router = useRouter();
  const { jobId, fileMetadata, updateJobConfig } = useSession();

  const [copies, setCopies] = useState(fileMetadata?.copies ?? 1);
  const [colorMode, setColorMode] = useState<ColorMode>(fileMetadata?.colorMode ?? "nb");
  const [duplex, setDuplex] = useState(fileMetadata?.duplex ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!jobId) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.configureJob(jobId, {
        copies,
        color_mode: colorMode,
        duplex,
        paper_format: "A4",
      });
      updateJobConfig({ copies, colorMode, duplex, price: data.price_fcfa });
      router.push("/flow/price");
    } catch (err: any) {
      setError(err.message || "Erreur de configuration.");
    } finally {
      setSaving(false);
    }
  };

  const pages = fileMetadata?.pages ?? 1;
  const sheets = duplex ? Math.ceil(pages / 2) : pages;
  const unitPrice = colorMode === "nb"
    ? 50
    : (duplex ? 250 : 150);
  const livePrice = unitPrice * sheets * copies;

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
      <StepHeader title="Options d'impression" step={3} />

      <div className="flex-1 px-4 py-5 flex flex-col gap-4 overflow-hidden">
        {/* Résumé du fichier */}
        {fileMetadata && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3 shrink-0 shadow-sm">
            <div className="w-10 h-10 bg-accent/15 rounded-xl flex items-center justify-center text-xl shrink-0">📄</div>
            <div className="min-w-0">
              <p className="font-semibold text-neutral-dark truncate text-sm">{fileMetadata.filename}</p>
              <p className="text-xs text-neutral-dark/50 mt-0.5">{fileMetadata.pages} page{fileMetadata.pages > 1 ? "s" : ""}</p>
            </div>
          </div>
        )}

        {/* Nombre de copies */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm shrink-0">
          <p className="text-xs font-semibold text-neutral-dark/60 mb-2 uppercase tracking-wider">Nombre de copies</p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCopies(Math.max(1, copies - 1))}
              className="w-10 h-10 rounded-xl bg-accent/20 text-primary text-xl font-bold flex items-center justify-center active:scale-95 transition-transform"
            >
              −
            </button>
            <span className="text-2xl font-bold text-primary tabular-nums">{copies}</span>
            <button
              onClick={() => setCopies(Math.min(20, copies + 1))}
              className="w-10 h-10 rounded-xl bg-accent/20 text-primary text-xl font-bold flex items-center justify-center active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </div>

        {/* Couleur */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm shrink-0">
          <p className="text-xs font-semibold text-neutral-dark/60 mb-2.5 uppercase tracking-wider">Mode d'impression</p>
          <div className="grid grid-cols-2 gap-3">
            {(["nb", "couleur"] as ColorMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setColorMode(mode)}
                className={`flex items-center justify-center py-2.5 rounded-xl font-semibold text-xs transition-all duration-200
                  ${colorMode === mode
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-accent/15 text-neutral-dark"
                  }`}
              >
                {mode === "nb" ? (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z" clipRule="evenodd" />
                    </svg>
                    N&B (50 F)
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 1.24-1.01 2.25-2.25 2.25h-1.85c-.35 0-.67.14-.9.38l-.13.13c-.2.2-.51.34-.84.34H12c-2.76 0-5 2.24-5 5 0 .26.04.51.11.75-.43.1-.88.15-1.34.15zM7.5 9.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S6 7.17 6 8s.67 1.5 1.5 1.5zm3.5-3c.83 0 1.5-.67 1.5-1.5S11.83 3.5 11 3.5 9.5 4.17 9.5 5 10.17 6.5 11 6.5zm4 0c.83 0 1.5-.67 1.5-1.5S15.83 3.5 15 3.5 13.5 4.17 13.5 5 14.17 6.5 15 6.5zm3.5 3c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S15 7.17 15 8s.67 1.5 1.5 1.5z"/>
                    </svg>
                    Couleur (150 F)
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Recto-verso */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-dark text-sm">Recto-verso</p>
              <p className="text-[11px] text-neutral-dark/50 mt-0.5">Économise du papier</p>
            </div>
            <button
              onClick={() => setDuplex(!duplex)}
              className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none
                ${duplex ? "bg-success" : "bg-neutral-dark/15"}
              `}
            >
              <span className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200
                ${duplex ? "translate-x-[22px]" : "translate-x-[2px]"}
              `} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-600 font-semibold shrink-0">
            ⚠️ {error}
          </div>
        )}

        {/* Zone prix fixe au-dessus du bouton */}
        <div className="mt-auto bg-slate-100 rounded-2xl p-4 border border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-semibold text-neutral-dark/55 uppercase tracking-wider">Prix estimé</span>
            <p className="text-[10px] text-neutral-dark/45 mt-0.5">{sheets} feuille{sheets > 1 ? "s" : ""} × {copies} copie{copies > 1 ? "s" : ""}</p>
          </div>
          <span className="text-xl font-extrabold text-primary">{livePrice.toLocaleString("fr-FR")} FCFA</span>
        </div>

        <button
          onClick={handleContinue}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-60 shrink-0"
        >
          {saving ? "Calcul du prix..." : "Continuer →"}
        </button>
      </div>
    </div>
  );
}
