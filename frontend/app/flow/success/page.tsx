"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";

export default function SuccessPage() {
  const router = useRouter();
  const { clearSession } = useSession();

  const handleNewPrint = () => {
    clearSession();
    router.replace("/");
  };

  return (
    <div className="flex flex-col flex-1 bg-success items-center justify-center p-6 text-white min-h-screen">
      <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-[bounce_1s_ease-in-out]">
        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h1 className="text-3xl font-black mb-2 text-center">Merci !</h1>
      <p className="text-white/90 text-center mb-8 max-w-xs font-medium">
        Votre document a été récupéré avec succès. À très bientôt sur nos bornes multiservices.
      </p>

      <button
        onClick={handleNewPrint}
        className="w-full max-w-sm py-4 rounded-2xl font-bold text-lg bg-white text-success shadow-lg active:scale-[0.98] transition-all"
      >
        Retour à l'accueil
      </button>
    </div>
  );
}
