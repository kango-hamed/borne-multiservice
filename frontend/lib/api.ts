const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorDetail = "Une erreur est survenue";
    try {
      const data = await response.json();
      errorDetail = data.detail || errorDetail;
    } catch {
      // Ignoré si le corps n'est pas du JSON
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json() as Promise<T>;
}

// ── Interfaces de réponse API ────────────────────────────────────────────────

export interface SessionResponse {
  session_token: string;
  kiosk_id: string;
  kiosk_name: string;
  expires_at: string;
  status: string;
}

export interface SessionStatus {
  session_token: string;
  status: string;
  expires_at: string;
  is_valid: boolean;
}

export interface JobCreateResponse {
  job_id: string;
  original_filename: string;
  pages: number;
  status: string;
  preview_url: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: string;
  pages: number;
  copies: number;
  color_mode: "nb" | "couleur";
  duplex: boolean;
  paper_format: "A4" | "A3";
  price_fcfa: number | null;
  queue_position: number | null;
  withdrawal_code: string | null;
}

export interface ScanStartResponse {
  scan_id: string;
  pages: number;
}

export interface ScanPageResponse {
  scan_id: string;
  page_number: number;
  pages: number;
  page_preview_url: string;
}

export interface ScanPagesResponse {
  scan_id: string;
  pages: number;
}

export interface PaymentInitiateResponse {
  payment_id: string;
  status: string;
  provider: string;
  amount_fcfa: number;
}

export interface PaymentStatusResponse {
  payment_id: string;
  status: string;
  job_status: string;
  amount_fcfa: number;
  provider: string;
  confirmed_at: string | null;
}

// ── Endpoints API ────────────────────────────────────────────────────────────

export const api = {
  // Initialise la session depuis le scan QR
  async createSession(kioskId: string): Promise<SessionResponse> {
    return request<SessionResponse>("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kiosk_id: kioskId }),
    });
  },

  // Valide le token de session
  async getSessionStatus(sessionToken: string): Promise<SessionStatus> {
    return request<SessionStatus>(`/sessions/${sessionToken}`);
  },

  // Upload du document
  async uploadFile(sessionToken: string, file: File): Promise<JobCreateResponse> {
    const formData = new FormData();
    formData.append("session_token", sessionToken);
    formData.append("file", file);

    return request<JobCreateResponse>("/jobs", {
      method: "POST",
      body: formData, // fetch gère le boundary Multipart automatiquement
    });
  },

  // ── Scan matériel : acquisition page par page depuis le scanner de la borne ──

  // Ouvre une session de scan (le choix N&B est figé pour tout le document)
  async scanStart(sessionToken: string, grayscale: boolean): Promise<ScanStartResponse> {
    const formData = new FormData();
    formData.append("session_token", sessionToken);
    formData.append("grayscale", grayscale ? "true" : "false");

    return request<ScanStartResponse>("/jobs/scan/start", {
      method: "POST",
      body: formData,
    });
  },

  // Numérise UNE page sur le scanner et l'ajoute au document
  async scanPage(scanId: string): Promise<ScanPageResponse> {
    return request<ScanPageResponse>(`/jobs/scan/${scanId}/page`, {
      method: "POST",
    });
  },

  // Retire une page mal numérisée
  async scanDeletePage(scanId: string, pageNumber: number): Promise<ScanPagesResponse> {
    return request<ScanPagesResponse>(`/jobs/scan/${scanId}/page/${pageNumber}`, {
      method: "DELETE",
    });
  },

  // Clôture : assemble le PDF et crée le job d'impression
  async scanFinish(scanId: string): Promise<JobCreateResponse> {
    return request<JobCreateResponse>(`/jobs/scan/${scanId}/finish`, {
      method: "POST",
    });
  },

  // Abandonne la session de scan (best-effort, ex: sortie de l'écran)
  async scanCancel(scanId: string): Promise<void> {
    await fetch(`${API_BASE_URL}/jobs/scan/${scanId}/cancel`, { method: "POST" }).catch(
      () => undefined
    );
  },

  // URL absolue de la vignette d'une page numérisée
  scanPagePreviewUrl(scanId: string, pageNumber: number): string {
    return `${API_BASE_URL}/jobs/scan/${scanId}/page/${pageNumber}/preview`;
  },

  // Configure l'impression
  async configureJob(
    jobId: string,
    config: {
      copies: number;
      color_mode: "nb" | "couleur";
      duplex: boolean;
      paper_format: "A4" | "A3";
    }
  ): Promise<JobStatusResponse> {
    return request<JobStatusResponse>(`/jobs/${jobId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  },

  // Statut du job (polling file d'attente / impression)
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return request<JobStatusResponse>(`/jobs/${jobId}`);
  },

  // Initie le paiement mobile money
  async initiatePayment(
    jobId: string,
    provider: string,
    phoneNumber: string
  ): Promise<PaymentInitiateResponse> {
    return request<PaymentInitiateResponse>(`/payments/${jobId}/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, phone_number: phoneNumber }),
    });
  },

  // Statut du paiement (polling)
  async getPaymentStatus(jobId: string): Promise<PaymentStatusResponse> {
    return request<PaymentStatusResponse>(`/payments/${jobId}/status`);
  },

  // Récupère l'URL absolue de l'aperçu du fichier
  getPreviewUrl(jobId: string): string {
    return `${API_BASE_URL}/jobs/${jobId}/preview`;
  },
};
