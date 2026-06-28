"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/StepHeader";
import { useSession } from "@/lib/session-context";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/image-utils";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.docx";
const MAX_SIZE_MB = 20;

export default function UploadPage() {
  const router = useRouter();
  const { sessionToken, setJob } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Fichier trop volumineux (maximum ${MAX_SIZE_MB} Mo).`;
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.endsWith(".docx")) {
      return "Format non supporté. Utilisez un PDF, JPG/PNG ou DOCX.";
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!sessionToken) {
      setError("Session expirée ou invalide. Veuillez rescanner le QR code.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Compression client-side si image lourde
      const fileToUpload = await compressImage(selectedFile);

      const data = await api.uploadFile(sessionToken, fileToUpload);
      setJob(data.job_id, data.original_filename, data.pages, data.preview_url);
      router.push("/flow/config");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du fichier.");
    } finally {
      setUploading(false);
    }
  };

  const fileSizeMB = selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : null;

  const fileTypeIcon = (type: string) => {
    if (type.includes("pdf")) return "📄";
    if (type.includes("image")) return "🖼️";
    return "📝";
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader title="Votre document" step={1} showBack={false} />

      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {/* Zone de dépôt */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-2xl p-8 cursor-pointer
            flex flex-col items-center justify-center gap-4 text-center
            transition-all duration-200 min-h-48
            ${isDragging ? "border-primary bg-accent/20 scale-[1.01]" : "border-accent bg-white hover:border-primary/50 hover:bg-accent/10"}
            ${selectedFile ? "border-success bg-success/5" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={handleFileChange}
          />

          {selectedFile ? (
            <>
              <div className="text-5xl">{fileTypeIcon(selectedFile.type)}</div>
              <div>
                <p className="font-semibold text-neutral-dark truncate max-w-[260px]">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-neutral-dark/50 mt-1">{fileSizeMB} Mo</p>
              </div>
              <span className="text-xs px-3 py-1 bg-success/15 text-success rounded-full font-semibold">
                Fichier sélectionné ✓
              </span>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-accent/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-primary">Choisir un fichier</p>
                <p className="text-xs text-neutral-dark/50 mt-1">PDF, JPG, PNG ou DOCX · Max {MAX_SIZE_MB} Mo</p>
              </div>
            </>
          )}
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Formats acceptés */}
        <div className="bg-white rounded-2xl p-4 border border-accent/30">
          <p className="text-xs font-semibold text-neutral-dark/50 uppercase tracking-wider mb-2">Formats acceptés</p>
          <div className="flex flex-wrap gap-2">
            {["PDF", "JPG / PNG", "DOCX"].map((fmt) => (
              <span key={fmt} className="px-3 py-1 bg-accent/20 text-primary text-xs font-semibold rounded-full">
                {fmt}
              </span>
            ))}
          </div>
        </div>

        {/* Bouton d'envoi */}
        <button
          suppressHydrationWarning
          disabled={!selectedFile || uploading}
          onClick={handleUpload}
          className={`
            mt-auto w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200
            ${selectedFile && !uploading
              ? "bg-primary text-white shadow-lg shadow-primary/30 active:scale-[0.98]"
              : "bg-neutral-dark/10 text-neutral-dark/30 cursor-not-allowed"
            }
          `}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Envoi en cours...
            </span>
          ) : "Continuer →"}
        </button>
      </div>
    </div>
  );
}
