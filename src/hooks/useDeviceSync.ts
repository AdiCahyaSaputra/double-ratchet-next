"use client";

import { useEffect, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { fromBase64 } from "@/lib/crypto/bytes";
import { decryptSyncEvent } from "@/lib/device-sync/sync-channel";
import { loadAccount } from "@/lib/storage/account-store";
import { importDeviceRecord } from "@/lib/storage/session-store";
import { deserializeRatchetState } from "@/lib/crypto/double-ratchet";

export function useDeviceSync() {
  const [account, setAccount] = useState<Awaited<
    ReturnType<typeof loadAccount>
  > | null>(null);
  const [syncedMessages, setSyncedMessages] = useState<
    Array<{ conversationId: string; plaintext: string; timestamp: number }>
  >([]);

  useEffect(() => {
    void loadAccount().then(setAccount);
  }, []);

  const deviceConvexId = account?.convexDeviceId as Id<"devices"> | undefined;

  const { results: events } = usePaginatedQuery(
    api.deviceSync.listSyncEvents,
    deviceConvexId && !account?.isPrimary
      ? { targetDeviceConvexId: deviceConvexId }
      : "skip",
    { initialNumItems: 50 },
  );

  useEffect(() => {
    if (!account?.syncChannelKey || !events?.length) return;

    async function processEvents() {
      const syncKey = fromBase64(account!.syncChannelKey!);
      for (const event of events!) {
        try {
          const payload = await decryptSyncEvent(
            syncKey,
            event.encryptedPayload,
          );
          if (payload.type === "message_copy") {
            setSyncedMessages((prev) => {
              const exists = prev.some(
                (m) =>
                  m.timestamp === payload.timestamp &&
                  m.plaintext === payload.plaintext,
              );
              if (exists) return prev;
              return [
                ...prev,
                {
                  conversationId: payload.conversationId,
                  plaintext: payload.plaintext,
                  timestamp: payload.timestamp,
                },
              ];
            });
          } else if (payload.type === "session_state") {
            await importDeviceRecord({
              remoteDeviceId: payload.remoteDeviceId,
              activeSession: {
                id: `synced-${payload.remoteDeviceId}`,
                ratchetState: deserializeRatchetState(payload.ratchetState),
                createdAt: Date.now(),
              },
              inactiveSessions: [],
            });
          }
        } catch {
          // skip invalid events
        }
      }
    }

    void processEvents();
  }, [events, account]);

  return { syncedMessages, account };
}
