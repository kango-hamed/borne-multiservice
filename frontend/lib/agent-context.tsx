"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface AgentSessionContextType {
  kioskId: string | null;
  agentPin: string | null;
  setAgentSession: (kioskId: string, pin: string) => void;
  clearAgentSession: () => void;
}

const AgentSessionContext = createContext<AgentSessionContextType | undefined>(undefined);

export function AgentSessionProvider({ children }: { children: React.ReactNode }) {
  const [kioskId, setKioskId] = useState<string | null>(null);
  const [agentPin, setAgentPin] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedKiosk = localStorage.getItem("agent_kiosk_id");
    const savedPin = localStorage.getItem("agent_pin");
    if (savedKiosk && savedPin) {
      setKioskId(savedKiosk);
      setAgentPin(savedPin);
    }
  }, []);

  const setAgentSession = (id: string, pin: string) => {
    setKioskId(id);
    setAgentPin(pin);
    localStorage.setItem("agent_kiosk_id", id);
    localStorage.setItem("agent_pin", pin);
  };

  const clearAgentSession = () => {
    setKioskId(null);
    setAgentPin(null);
    localStorage.removeItem("agent_kiosk_id");
    localStorage.removeItem("agent_pin");
  };

  return (
    <AgentSessionContext.Provider
      value={{
        kioskId,
        agentPin,
        setAgentSession,
        clearAgentSession,
      }}
    >
      {children}
    </AgentSessionContext.Provider>
  );
}

export function useAgentSession() {
  const context = useContext(AgentSessionContext);
  if (context === undefined) {
    throw new Error("useAgentSession must be used within an AgentSessionProvider");
  }
  return context;
}
