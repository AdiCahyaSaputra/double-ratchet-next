"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  encodeQRData,
  type ProvisioningQRData,
} from "@/lib/device-sync/provisioning";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QrCode } from "lucide-react";

interface LinkDeviceQRProps {
  payload: ProvisioningQRData;
}

export function LinkDeviceQR({ payload }: LinkDeviceQRProps) {
  const encoded = encodeQRData(payload);
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <QrCode className="size-5 text-primary" />
        </div>
        <CardTitle>Scan to link device</CardTitle>
        <CardDescription>
          Scan this QR code with your primary device to link{" "}
          <strong>{payload.deviceName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="rounded-xl bg-white p-4">
          <QRCodeSVG value={encoded} size={256} />
        </div>
        <p className="text-xs text-muted-foreground">Expires in 10 minutes</p>
      </CardContent>
    </Card>
  );
}
