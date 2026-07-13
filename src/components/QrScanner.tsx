"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser/esm/common/IScannerControls";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QrScannerProps {
  onScan: (text: string) => void;
  onError?: (error: string) => void;
  active?: boolean;
}

export function QrScanner({ onScan, onError, active = true }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!active || scannedRef.current) return;

    const reader = new BrowserMultiFormatReader();

    async function start() {
      if (!videoRef.current) return;

      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId;

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (result && !scannedRef.current) {
              scannedRef.current = true;
              controlsRef.current?.stop();
              onScan(result.getText());
            }
          },
        );
        controlsRef.current = controls;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Camera access failed";
        setError(message);
        onError?.(message);
      }
    }

    void start();

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, onScan, onError]);

  return (
    <div className="space-y-3">
      <div className="mx-auto aspect-square max-w-sm overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
