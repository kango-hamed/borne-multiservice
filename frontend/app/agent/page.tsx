"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, KioskPublic } from "@/lib/api";
import { useAgentSession } from "@/lib/agent-context";

export default function AgentLoginPage() {
  const router = useRouter();
  const { setAgentSession } = useAgentSession();

  const [kiosks, setKiosks] = useState<KioskPublic[]>([]);
  const [selectedKiosk, setSelectedKiosk] = useState<string>("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load kiosks
    api.listKiosks().then((data) => {
      setKiosks(data);
      if (data.length > 0) setSelectedKiosk(data[0].id);
    }).catch(console.error);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKiosk || pin.length !== 4) return;

    setLoading(true);
    setError(null);
    try {
      // Pour vérifier si le PIN est correct, on tente de récupérer la file de la borne.
      // Si le PIN est mauvais, l'API renvoie une erreur (401/403).
      await api.getAdminQueue(selectedKiosk, pin);
      
      // Connexion réussie, on sauvegarde
      setAgentSession(selectedKiosk, pin);
      router.push("/agent/dashboard");
    } catch (err: any) {
      setError("PIN incorrect ou borne introuvable.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-primary px-6 items-center justify-center min-h-screen">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-neutral-dark mb-2">Espace Agent</h1>
        <p className="text-sm text-center text-neutral-dark/50 mb-8">
          Veuillez sélectionner votre borne et saisir votre code PIN.
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-neutral-dark/70 mb-2">
              Votre Borne
            </label>
            <select
              value={selectedKiosk}
              onChange={(e) => setSelectedKiosk(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-neutral-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {kiosks.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-dark/70 mb-2">
              Code PIN (4 chiffres)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[1em] font-bold text-neutral-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-2.5 rounded-xl text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4 || loading || !selectedKiosk}
            className="w-full mt-2 bg-primary text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 disabled:bg-neutral-dark/10 disabled:text-neutral-dark/30 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
