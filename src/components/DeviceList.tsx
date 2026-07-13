"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone } from "lucide-react";

interface DeviceListProps {
  accountId: Id<"accounts">;
  currentDeviceConvexId?: string;
  onUnlink?: (deviceConvexId: Id<"devices">) => void;
}

export function DeviceList({
  accountId,
  currentDeviceConvexId,
  onUnlink,
}: DeviceListProps) {
  const devices = useQuery(api.devices.listDevicesForAccount, { accountId });

  if (devices === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Smartphone className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No linked devices.</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y overflow-hidden p-0">
      {devices.map((device) => (
        <div
          key={device._id}
          className="flex items-center justify-between px-4 py-3"
        >
          <div>
            <p className="flex items-center gap-2 font-medium">
              {device.deviceName}
              {device.isPrimary && <Badge variant="secondary">Primary</Badge>}
              {device._id === currentDeviceConvexId && (
                <span className="text-xs text-muted-foreground">
                  (this device)
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Last seen {new Date(device.lastSeenAt).toLocaleString()}
            </p>
          </div>
          {!device.isPrimary && onUnlink && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onUnlink(device._id)}
            >
              Unlink
            </Button>
          )}
        </div>
      ))}
    </Card>
  );
}
