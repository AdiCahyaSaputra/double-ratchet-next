"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LinkDeviceQR } from "@/components/LinkDeviceQR";
import { SyncProgress } from "@/components/SyncProgress";
import { useDeviceLinking } from "@/hooks/useDeviceLinking";
import { useRequireAuth, AuthLoading } from "@/hooks/useRequireAuth";
import { encodeQRData } from "@/lib/device-sync/provisioning";
import { detectDeviceName } from "@/lib/device-name";
import { loadPendingAuth } from "@/lib/auth/pending-auth";
import { hasLocalSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function LinkPage() {
  const { ready } = useRequireAuth({ allowPendingLink: true });
  const [deviceName, setDeviceName] = useState(() => detectDeviceName());
  const [pendingUsername] = useState<string | null>(() => {
    const pending = loadPendingAuth();
    return pending?.username ?? null;
  });
  const [hasSession, setHasSession] = useState(false);
  const { qrPayload, startLinking, syncStatus } = useDeviceLinking();

  useEffect(() => {
    void hasLocalSession().then(setHasSession);
  }, []);

  if (!ready) {
    return <AuthLoading />;
  }

  const canGoHome = hasSession || syncStatus === "complete";

  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <Button
        key={canGoHome ? "home" : "login"}
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2"
        nativeButton={false}
        render={<Link href={canGoHome ? "/" : "/login"} />}
      >
        <ArrowLeft />
        {canGoHome ? "Home" : "Sign in"}
      </Button>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Link this device</h1>

      {pendingUsername && (
        <Alert className="mb-6">
          <AlertDescription>
            Signed in as <strong>{pendingUsername}</strong>. Generate a QR code
            below, then scan it from your primary device to complete linking.
          </AlertDescription>
        </Alert>
      )}

      {!qrPayload ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate QR code</CardTitle>
            <CardDescription>
              This device will be named automatically. Generate a QR code for
              your primary device to scan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deviceName">Device name</Label>
              <Input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Chrome on macOS"
              />
            </div>
            <Button
              className="w-full"
              onClick={() =>
                void startLinking(deviceName.trim() || detectDeviceName())
              }
            >
              Generate QR code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <LinkDeviceQR payload={qrPayload} />
          <div className="mt-4">
            <SyncProgress status={syncStatus} />
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Show QR data for manual paste
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              {encodeQRData(qrPayload)}
            </pre>
          </details>
        </>
      )}
    </main>
  );
}
