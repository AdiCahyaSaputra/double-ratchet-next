"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DeviceList } from "@/components/DeviceList";
import { QrScanner } from "@/components/QrScanner";
import { loadAccount } from "@/lib/storage/account-store";
import { ensureIdentityStore } from "@/lib/storage/identity-store";
import { useDeviceLinking } from "@/hooks/useDeviceLinking";
import { useRequireAuth, AuthLoading } from "@/hooks/useRequireAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";

export default function DevicesPage() {
  const { ready } = useRequireAuth();
  const [account, setAccount] = useState<Awaited<
    ReturnType<typeof loadAccount>
  > | null>(null);
  const [qrInput, setQrInput] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { completeLinkAsPrimary, syncStatus } = useDeviceLinking();
  const unlinkDevice = useMutation(api.devices.unlinkDevice);

  useEffect(() => {
    void loadAccount().then(setAccount);
  }, []);

  const handleLink = useCallback(
    async (qrData: string) => {
      setLinkError(null);
      setScanning(false);
      try {
        await completeLinkAsPrimary(qrData, true);
        setQrInput("");
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : "Linking failed");
        setScanning(true);
      }
    },
    [completeLinkAsPrimary],
  );

  async function handleUnlink(deviceConvexId: Id<"devices">) {
    const identity = await ensureIdentityStore();
    if (!account) return;
    await unlinkDevice({
      primaryDeviceId: identity.deviceId,
      primaryDeviceConvexId: account.convexDeviceId as Id<"devices">,
      targetDeviceConvexId: deviceConvexId,
    });
  }

  if (!ready || !account) {
    return <AuthLoading />;
  }

  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <Button variant="ghost" size="sm" className="mb-6 -ml-2" render={<Link href="/" />}>
        <ArrowLeft />
        Home
      </Button>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Linked devices</h1>

      <DeviceList
        accountId={account.accountId as Id<"accounts">}
        currentDeviceConvexId={account.convexDeviceId}
        onUnlink={account.isPrimary ? handleUnlink : undefined}
      />

      {account.isPrimary && (
        <>
          <Separator className="my-8" />
          <Card>
            <CardHeader>
              <CardTitle>Link new device</CardTitle>
              <CardDescription>
                Scan the QR code shown on the device you want to link, or paste
                the data manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {scanning && !showPaste && (
                <QrScanner
                  active={scanning}
                  onScan={(text) => void handleLink(text)}
                  onError={() => setShowPaste(true)}
                />
              )}

              {!showPaste ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setShowPaste(true);
                    setScanning(false);
                  }}
                >
                  Paste QR data manually
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="qrData">QR code data</Label>
                    <Textarea
                      id="qrData"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      placeholder='{"provisioningId":"...","ephemeralPublicKey":"...","deviceName":"..."}'
                      className="min-h-24"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => void handleLink(qrInput)}
                      disabled={!qrInput.trim()}
                    >
                      Complete linking
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPaste(false);
                        setScanning(true);
                      }}
                    >
                      Use camera
                    </Button>
                  </div>
                </div>
              )}

              {linkError && (
                <p className="text-sm text-destructive">{linkError}</p>
              )}
              {syncStatus !== "idle" && (
                <p className="text-sm text-muted-foreground">
                  Sync status: {syncStatus}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
