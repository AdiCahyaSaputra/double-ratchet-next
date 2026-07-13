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

function releaseVideoElement(video: HTMLVideoElement | null) {
  if (!video) return;

  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  video.srcObject = null;
  video.removeAttribute("src");
}

export function QrScanner({ onScan, onError, active = true }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    function stopCamera() {
      controlsRef.current?.stop();
      controlsRef.current = null;
      releaseVideoElement(videoRef.current);
      BrowserMultiFormatReader.releaseAllStreams();
    }

    const reader = new BrowserMultiFormatReader();

    async function start() {
      const video = videoRef.current;
      if (!video || cancelled) return;

      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;

        const deviceId = devices[0]?.deviceId;

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          video,
          (result, _err, scanControls) => {
            if (!result || cancelled) return;

            scanControls.stop();
            controlsRef.current = null;
            releaseVideoElement(video);
            BrowserMultiFormatReader.releaseAllStreams();
            onScanRef.current(result.getText());
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (err) {
        if (cancelled) return;

        stopCamera();
        const message =
          err instanceof Error ? err.message : "Camera access failed";
        setError(message);
        onErrorRef.current?.(message);
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [active]);

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
