"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAgentSession } from "@/lib/agent-context";
import { api, AdminQueueJob, AdminQueueResponse } from "@/lib/api";

export default function AgentDashboardPage() {
  const router = useRouter();
  const { kioskId, agentPin, clearAgentSession } = useAgentSession();

  const [queue, setQueue] = useState<AdminQueueResponse | null>(null);
  const [history, setHistory] = useState<AdminQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");

  // Pour la validation du retrait
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [withdrawCode, setWithdrawCode] = useState<string>("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const fetchQueue = async () => {
    if (!kioskId || !agentPin) return;
    try {
      if (activeTab === "queue") {
        const data = await api.getAdminQueue(kioskId, agentPin);
        setQueue(data);
      } else {
        const data = await api.getAdminHistory(kioskId, agentPin);
        setHistory(data);
      }
      setError(null);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        clearAgentSession();
        router.replace("/agent");
      } else {
        setError("Erreur de connexion à la borne.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!kioskId || !agentPin) {
      router.replace("/agent");
      return;
    }
    
    fetchQueue();
    // Auto-refresh toutes les 5 secondes
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [kioskId, agentPin, router, activeTab]);

  const handleLogout = () => {
    clearAgentSession();
    router.replace("/agent");
  };

  const handleWithdraw = async (jobId: string) => {
    if (withdrawCode.length !== 4 || !agentPin) return;
    setIsWithdrawing(true);
    setWithdrawError(null);

    try {
      await api.withdrawJob(jobId, agentPin, withdrawCode);
      setWithdrawCode("");
      setActiveJobId(null);
      fetchQueue(); // Rafraîchir immédiatement
    } catch (err: any) {
      setWithdrawError("Code de retrait invalide.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (loading && !queue && !history) {
    return <div className="flex-1 flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-primary text-white px-5 py-4 shadow-md sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Tableau de Bord</h1>
            <p className="text-accent/80 text-xs font-medium uppercase tracking-wider mt-0.5">
              {queue?.kiosk_name || history?.kiosk_name || "Agent"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white/70 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("queue")}
            className={`pb-2 text-sm font-bold transition-all border-b-2 ${activeTab === "queue" ? "border-white text-white" : "border-transparent text-white/50"}`}
          >
            File d'attente
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2 text-sm font-bold transition-all border-b-2 ${activeTab === "history" ? "border-white text-white" : "border-transparent text-white/50"}`}
          >
            Historique du jour
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm font-medium p-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-dark">
            {activeTab === "queue" ? `File d'attente (${queue?.total || 0})` : `Historique (${history?.total || 0})`}
          </h2>
          {/* Status Indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-dark/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            En direct
          </div>
        </div>

        {(activeTab === "queue" ? queue?.jobs : history?.jobs)?.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-10">
            <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">
              {activeTab === "queue" ? "Aucun document en attente." : "Aucun retrait aujourd'hui."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {(activeTab === "queue" ? queue?.jobs : history?.jobs)?.map((job) => (
              <div key={job.job_id} className={`bg-white rounded-2xl p-4 shadow-sm border ${activeTab === "history" ? 'border-success/20' : 'border-neutral-dark/5'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {activeTab === "queue" ? (
                      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold shrink-0">
                        #{job.queue_position}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-neutral-dark text-sm truncate max-w-[200px]">
                        {job.original_filename}
                      </p>
                      <p className="text-xs text-neutral-dark/50 mt-0.5">
                        {job.pages} page(s) • {job.color_mode === 'couleur' ? 'Couleur' : 'N&B'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary">{job.price_fcfa} FCFA</span>
                  </div>
                </div>

                {/* Statut dynamique - Queue */}
                {activeTab === "queue" && job.status === "paye" && (
                  <div className="bg-orange-50 text-orange-600 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-center">
                    En attente d'impression
                  </div>
                )}

                {activeTab === "queue" && job.status === "impression_en_cours" && (
                  <div className="bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-center flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Impression en cours...
                  </div>
                )}

                {activeTab === "queue" && job.status === "pret_a_retirer" && activeJobId !== job.job_id && (
                  <button
                    onClick={() => setActiveJobId(job.job_id)}
                    className="w-full bg-success/10 text-success font-bold text-sm py-2.5 rounded-xl hover:bg-success/20 transition-colors"
                  >
                    Valider le retrait
                  </button>
                )}

                {/* Formulaire de retrait actif */}
                {activeTab === "queue" && job.status === "pret_a_retirer" && activeJobId === job.job_id && (
                  <div className="mt-3 p-3 bg-neutral-dark/5 rounded-xl border border-neutral-dark/10">
                    <p className="text-xs font-semibold text-neutral-dark/60 mb-2 text-center">
                      Saisissez le code client à 4 chiffres :
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={withdrawCode}
                        onChange={(e) => setWithdrawCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••"
                        className="flex-1 text-center font-bold text-xl tracking-[0.5em] bg-white border border-neutral-dark/10 rounded-lg focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={() => handleWithdraw(job.job_id)}
                        disabled={withdrawCode.length !== 4 || isWithdrawing}
                        className="bg-primary text-white font-bold px-4 rounded-lg disabled:opacity-50"
                      >
                        OK
                      </button>
                    </div>
                    {withdrawError && <p className="text-red-500 text-xs mt-2 text-center font-medium">{withdrawError}</p>}
                    <button
                      onClick={() => {
                        setActiveJobId(null);
                        setWithdrawCode("");
                        setWithdrawError(null);
                      }}
                      className="w-full text-center text-xs font-semibold text-neutral-dark/40 mt-3"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {/* History status */}
                {activeTab === "history" && (
                  <div className="bg-success/10 text-success text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-center">
                    Récupéré avec succès
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
