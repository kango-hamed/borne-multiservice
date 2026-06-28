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
      <StepHeader title="Options d'impression" step={2} />

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
                className={`py-3 rounded-xl font-semibold text-sm transition-all duration-200
                  ${colorMode === mode
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-accent/15 text-neutral-dark"
                  }`}
              >
                {mode === "nb" ? "⬛ Noir & Blanc" : "🎨 Couleur"}
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
              className={`relative w-14 h-7 rounded-full transition-colors duration-200
                ${duplex ? "bg-success" : "bg-neutral-dark/15"}
              `}
            >
              <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-200
                ${duplex ? "translate-x-7" : "translate-x-0.5"}
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
