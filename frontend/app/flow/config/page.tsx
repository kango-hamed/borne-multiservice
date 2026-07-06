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

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Options d'impression" step={3} />

      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {/* Résumé du fichier */}
        {fileMetadata && (
          <div className="bg-white rounded-2xl p-4 border border-accent/30 flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-xl shrink-0">📄</div>
            <div className="min-w-0">
              <p className="font-semibold text-neutral-dark truncate">{fileMetadata.filename}</p>
              <p className="text-xs text-neutral-dark/50 mt-0.5">{fileMetadata.pages} page{fileMetadata.pages > 1 ? "s" : ""}</p>
            </div>
          </div>
        )}

        {/* Nombre de copies */}
        <div className="bg-white rounded-2xl p-4 border border-accent/30">
          <p className="text-sm font-semibold text-neutral-dark/60 mb-3">Nombre de copies</p>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCopies(Math.max(1, copies - 1))}
              className="w-12 h-12 rounded-xl bg-accent/20 text-primary text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
            >
              −
            </button>
            <span className="text-3xl font-bold text-primary tabular-nums">{copies}</span>
            <button
              onClick={() => setCopies(Math.min(20, copies + 1))}
              className="w-12 h-12 rounded-xl bg-accent/20 text-primary text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </div>

        {/* Couleur */}
        <div className="bg-white rounded-2xl p-4 border border-accent/30">
          <p className="text-sm font-semibold text-neutral-dark/60 mb-3">Mode d'impression</p>
          <div className="grid grid-cols-2 gap-3">
            {(["nb", "couleur"] as ColorMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setColorMode(mode)}
                className={`flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all duration-200
                  ${colorMode === mode
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-accent/15 text-neutral-dark"
                  }`}
              >
                {mode === "nb" ? (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z" clipRule="evenodd" />
                    </svg>
                    Noir & Blanc
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 1.24-1.01 2.25-2.25 2.25h-1.85c-.35 0-.67.14-.9.38l-.13.13c-.2.2-.51.34-.84.34H12c-2.76 0-5 2.24-5 5 0 .26.04.51.11.75-.43.1-.88.15-1.34.15zM7.5 9.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S6 7.17 6 8s.67 1.5 1.5 1.5zm3.5-3c.83 0 1.5-.67 1.5-1.5S11.83 3.5 11 3.5 9.5 4.17 9.5 5 10.17 6.5 11 6.5zm4 0c.83 0 1.5-.67 1.5-1.5S15.83 3.5 15 3.5 13.5 4.17 13.5 5 14.17 6.5 15 6.5zm3.5 3c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S15 7.17 15 8s.67 1.5 1.5 1.5z"/>
                    </svg>
                    Couleur
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Recto-verso */}
        <div className="bg-white rounded-2xl p-4 border border-accent/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-dark">Recto-verso</p>
              <p className="text-xs text-neutral-dark/50 mt-0.5">Économise du papier</p>
            </div>
            <button
              onClick={() => setDuplex(!duplex)}
              className={`relative shrink-0 w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none
                ${duplex ? "bg-success" : "bg-neutral-dark/15"}
              `}
            >
              <span className={`absolute top-[2px] w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200
                ${duplex ? "translate-x-[26px]" : "translate-x-[2px]"}
              `} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={saving}
          className="mt-auto w-full py-4 rounded-2xl font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {saving ? "Calcul du prix..." : "Voir le prix →"}
        </button>
      </div>
    </div>
  );
}
