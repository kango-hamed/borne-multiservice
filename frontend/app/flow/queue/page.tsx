"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { PollingStatusBanner } from "@/components/PollingStatus";
import { useSession } from "@/lib/session-context";
import { usePolling } from "@/hooks/usePolling";
import { api, JobStatusResponse } from "@/lib/api";

const TERMINAL_PRINT_STATUSES = ["printed", "ready_for_pickup", "error"];

export default function QueuePage() {
  const router = useRouter();
  const { jobId, setWithdrawalCode } = useSession();

  const queryFn = useCallback(() => {
    if (!jobId) throw new Error("Pas de job");
    return api.getJobStatus(jobId);
  }, [jobId]);

  const checkSuccess = useCallback(
    (data: JobStatusResponse) => data.status === "pret_a_retirer",
    []
  );
  const checkFailure = useCallback(
    (data: JobStatusResponse) => data.status === "paiement_expire",
    []
  );

  const { data, status, error } = usePolling<JobStatusResponse>({
    queryFn,
    checkSuccess,
    checkFailure,
    intervalMs: 3000,
    enabled: !!jobId,
  });

  React.useEffect(() => {
    if (status === "success") {
      if (data?.withdrawal_code) {
        setWithdrawalCode(data.withdrawal_code);
      }
      router.push("/flow/ready");
    }
  }, [status, router]);

  const queuePos = data?.queue_position ?? null;
  const printStatus = data?.status ?? "queued";

  const statusLabel: Record<string, string> = {
    paye: "En file d'attente",
    impression_en_cours: "Impression en cours",
    pret_a_retirer: "Prêt à récupérer",
    paiement_expire: "Erreur d'impression",
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Votre impression" step={6} showBack={false} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
        {/* Position dans la file */}
        {queuePos !== null && queuePos > 1 ? (
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-accent/20 border-4 border-primary/20 flex flex-col items-center justify-center mb-4 mx-auto">
              <span className="text-4xl font-black text-primary">{queuePos}</span>
              <span className="text-xs font-semibold text-primary/60">en file</span>
            </div>
            <h2 className="text-xl font-bold text-neutral-dark">Document en attente</h2>
            <p className="text-neutral-dark/60 text-sm mt-2">
              {queuePos === 2 ? "Votre document est le suivant !" : `Il y a ${queuePos - 1} document${queuePos > 2 ? "s" : ""} avant le vôtre.`}
            </p>
          </div>
        ) : (
          <div className="text-center">
            {/* Imprimante animée */}
            <div className="relative inline-block mb-4">
              <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-14 h-14 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-full animate-ping bg-primary/10" />
            </div>

            <h2 className="text-xl font-bold text-neutral-dark">
              {statusLabel[printStatus] ?? "En cours..."}
            </h2>
            <p className="text-neutral-dark/60 text-sm mt-2 max-w-xs">
              {printStatus === "impression_en_cours"
                ? "Votre document est en cours d'impression. Encore un instant !"
                : "Votre document est en tête de file et sera imprimé très bientôt."}
            </p>
          </div>
        )}

        {/* Progression visuelle */}
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-dark/50 mb-2">
            <span>Paiement confirmé</span>
            <span>Impression</span>
            <span>Récupération</span>
          </div>
          <div className="h-2 rounded-full bg-accent/30 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{
                width: printStatus === "paye" ? "40%" : printStatus === "impression_en_cours" ? "75%" : "100%",
              }}
            />
          </div>
        </div>
      </div>

      <PollingStatusBanner
        status={status}
        error={error}
        loadingText="Vérification de l'impression..."
        reconnectingText="Reconnexion..."
      />
    </div>
  );
}
