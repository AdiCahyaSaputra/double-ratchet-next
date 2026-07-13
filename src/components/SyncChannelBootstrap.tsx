"use client";

import { useEffect } from "react";
import { ensureSyncChannelKey } from "@/lib/device-sync/ensure-sync-channel-key";
import { hasLocalSession } from "@/lib/auth/session";

export function SyncChannelBootstrap() {
  useEffect(() => {
    void (async () => {
      if (!(await hasLocalSession())) return;
      await ensureSyncChannelKey();
    })();
  }, []);

  return null;
}
