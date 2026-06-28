"use client";

import React from "react";
import type { PollingStatus } from "@/hooks/usePolling";

interface PollingStatusProps {
  status: PollingStatus;
  error?: string | null;
  loadingText?: string;
  reconnectingText?: string;
}

export function PollingStatusBanner({
  status,
  error,
  loadingText = "Vérification en cours...",
  reconnectingText = "Reconnexion en cours...",
}: PollingStatusProps) {
  if (status === "idle" || status === "success") return null;

  const isReconnecting = status === "reconnecting";
  const isError = status === "error";

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
        transition-all duration-300
        ${isReconnecting ? "bg-warning text-neutral-dark" : ""}
        ${isError ? "bg-red-500 text-white" : ""}
        ${status === "polling" ? "bg-white text-primary border border-accent shadow-accent/20" : ""}
      `}
    >
      {(status === "polling" || isReconnecting) && (
        <svg
          className={`w-5 h-5 shrink-0 animate-spin ${isReconnecting ? "text-neutral-dark" : "text-primary"}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}

      {isError && (
        <svg className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      )}

      <p className="text-sm font-medium">
        {isError ? (error ?? "Erreur de connexion.") : isReconnecting ? reconnectingText : loadingText}
      </p>
    </div>
  );
}
