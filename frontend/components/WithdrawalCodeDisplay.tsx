"use client";

import React from "react";

interface WithdrawalCodeDisplayProps {
  code: string;
  kioskName?: string | null;
}

export function WithdrawalCodeDisplay({ code, kioskName }: WithdrawalCodeDisplayProps) {
  const digits = code.split("");

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      {/* Icône succès animé */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-success"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-full animate-ping bg-success/20" />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-neutral-dark/60 uppercase tracking-widest mb-1">
          Code de retrait
        </p>
        {kioskName && (
          <p className="text-xs text-neutral-dark/40 mb-4">{kioskName}</p>
        )}

        {/* Affichage premium des 4 chiffres */}
        <div className="flex gap-3 justify-center">
          {digits.map((digit, idx) => (
            <div
              key={idx}
              className="
                w-16 h-20 rounded-2xl
                bg-primary text-white
                flex items-center justify-center
                text-4xl font-bold tracking-widest
                shadow-lg shadow-primary/30
                border-2 border-accent/20
              "
            >
              {digit}
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-neutral-dark/60 max-w-xs text-center">
          Présentez ce code à l'agent pour récupérer votre document imprimé.
        </p>
      </div>
    </div>
  );
}
