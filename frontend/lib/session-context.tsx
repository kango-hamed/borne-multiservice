"use client";

import React, { createContext, useContext, useState } from "react";

export interface FileMetadata {
  filename: string;
  pages: number;
  copies: number;
  colorMode: "nb" | "couleur";
  duplex: boolean;
  paperFormat: "A4" | "A3";
  price: number | null;
  previewUrl?: string;
}

interface SessionContextType {
  sessionToken: string | null;
  kioskId: string | null;
  kioskName: string | null;
  jobId: string | null;
  fileMetadata: FileMetadata | null;
  withdrawalCode: string | null;
  setSession: (token: string, kioskId: string, kioskName: string) => void;
  setJob: (jobId: string, filename: string, pages: number, previewUrl?: string) => void;
  updateJobConfig: (config: Partial<FileMetadata>) => void;
  setWithdrawalCode: (code: string) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [kioskId, setKioskId] = useState<string | null>(null);
  const [kioskName, setKioskName] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [withdrawalCode, setWithdrawalCodeState] = useState<string | null>(null);

  const setSession = (token: string, kId: string, kName: string) => {
    setSessionToken(token);
    setKioskId(kId);
    setKioskName(kName);
  };

  const setJob = (jId: string, filename: string, pages: number, previewUrl?: string) => {
    setJobId(jId);
    setFileMetadata({
      filename,
      pages,
      copies: 1,
      colorMode: "nb",
      duplex: false,
      paperFormat: "A4",
      price: null,
      previewUrl,
    });
    setWithdrawalCodeState(null);
  };

  const updateJobConfig = (config: Partial<FileMetadata>) => {
    setFileMetadata((prev) => {
      if (!prev) return null;
      return { ...prev, ...config };
    });
  };

  const setWithdrawalCode = (code: string) => {
    setWithdrawalCodeState(code);
  };

  const clearSession = () => {
    setSessionToken(null);
    setKioskId(null);
    setKioskName(null);
    setJobId(null);
    setFileMetadata(null);
    setWithdrawalCodeState(null);
  };

  return (
    <SessionContext.Provider
      value={{
        sessionToken,
        kioskId,
        kioskName,
        jobId,
        fileMetadata,
        withdrawalCode,
        setSession,
        setJob,
        updateJobConfig,
        setWithdrawalCode,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
