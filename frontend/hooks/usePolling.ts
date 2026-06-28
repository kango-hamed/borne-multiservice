"use client";

import { useEffect, useRef, useState } from "react";

export type PollingStatus = "idle" | "polling" | "reconnecting" | "success" | "error";

interface UsePollingOptions<T> {
  queryFn: () => Promise<T>;
  checkSuccess: (data: T) => boolean;
  checkFailure?: (data: T) => boolean;
  intervalMs?: number;
  maxRetries?: number;
  enabled?: boolean;
}

export function usePolling<T>({
  queryFn,
  checkSuccess,
  checkFailure,
  intervalMs = 2500,
  maxRetries = 10,
  enabled = true,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<PollingStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const queryFnRef = useRef(queryFn);
  const checkSuccessRef = useRef(checkSuccess);
  const checkFailureRef = useRef(checkFailure);

  // Garde les références à jour sans déclencher le useEffect
  useEffect(() => {
    queryFnRef.current = queryFn;
    checkSuccessRef.current = checkSuccess;
    checkFailureRef.current = checkFailure;
  }, [queryFn, checkSuccess, checkFailure]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let isMounted = true;
    let timerId: NodeJS.Timeout | null = null;
    let retryCount = 0;

    const runPoll = async () => {
      if (!isMounted) return;

      try {
        const result = await queryFnRef.current();
        
        if (!isMounted) return;

        setData(result);
        setError(null);
        retryCount = 0; // Reset les tentatives de reconnexion après un succès réseau

        if (checkSuccessRef.current(result)) {
          setStatus("success");
          return; // Arrêt du polling
        }

        if (checkFailureRef.current && checkFailureRef.current(result)) {
          setStatus("error");
          setError("Le traitement a échoué.");
          return; // Arrêt du polling
        }

        setStatus("polling");
        // Planifie la prochaine itération
        timerId = setTimeout(runPoll, intervalMs);
      } catch (err: any) {
        if (!isMounted) return;

        console.warn("Erreur de polling réseau:", err);
        retryCount++;

        if (retryCount >= maxRetries) {
          setStatus("error");
          setError(err.message || "Erreur de connexion persistante.");
        } else {
          // Transition vers l'état de reconnexion
          setStatus("reconnecting");
          // Re-planifie avec un backoff exponentiel léger (max 10s)
          const backoff = Math.min(intervalMs * Math.pow(1.5, retryCount), 10000);
          timerId = setTimeout(runPoll, backoff);
        }
      }
    };

    setStatus("polling");
    runPoll();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [enabled, intervalMs, maxRetries]);

  return { data, status, error };
}
