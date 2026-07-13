"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SyncStatus =
  | "idle"
  | "uploading"
  | "downloading"
  | "complete"
  | "error";

interface SyncProgressProps {
  status: SyncStatus;
  message?: string;
}

export function SyncProgress({ status, message }: SyncProgressProps) {
  if (status === "idle") return null;

  const labels: Record<SyncStatus, string> = {
    idle: "",
    uploading: "Uploading encrypted archive...",
    downloading: "Downloading and decrypting archive...",
    complete: "Sync complete",
    error: message ?? "Sync failed",
  };

  const isError = status === "error";
  const isComplete = status === "complete";
  const isLoading = status === "uploading" || status === "downloading";

  return (
    <Alert
      variant={isError ? "destructive" : "default"}
      className={cn(
        isComplete && "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
      )}
    >
      {isLoading && <Loader2 className="animate-spin" />}
      {isComplete && <CheckCircle2 />}
      {isError && <XCircle />}
      <AlertDescription>{labels[status]}</AlertDescription>
    </Alert>
  );
}
