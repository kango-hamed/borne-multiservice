"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";

interface StepHeaderProps {
  title: string;
  step: number;
  totalSteps?: number;
  showBack?: boolean;
  onBack?: () => void;
}

export function StepHeader({
  title,
  step,
  totalSteps = 6,
  showBack = true,
  onBack,
}: StepHeaderProps) {
  const router = useRouter();
  const { kioskName } = useSession();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Calcul du pourcentage de progression
  const progressPercent = Math.min((step / totalSteps) * 100, 100);

  return (
    <header className="sticky top-0 z-30 bg-primary text-white shadow-md">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Retour"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
            {kioskName && (
              <p className="text-xs text-accent/80 font-medium truncate max-w-[200px]">
                {kioskName}
              </p>
            )}
          </div>
        </div>

        {step > 0 && (
          <div className="text-right">
            <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">
              Étape {step}/{totalSteps}
            </span>
          </div>
        )}
      </div>

      {/* Barre de progression fluide */}
      {step > 0 && (
        <div className="w-full h-1 bg-white/20">
          <div
            className="h-full bg-success transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </header>
  );
}
