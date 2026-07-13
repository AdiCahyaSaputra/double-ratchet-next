"use client";

import { useEffect, useRef, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { fromBase64 } from "@/lib/crypto/bytes";
import { decryptSyncEvent } from "@/lib/device-sync/sync-channel";
import { loadAccount } from "@/lib/storage/account-store";
import { ensureSyncChannelKey } from "@/lib/device-sync/ensure-sync-channel-key";
import {
  appendMessageHistory,
  loadMessageHistory,
  type HistoryMessage,
} from "@/lib/storage/message-history-store";
import { importDeviceRecord } from "@/lib/storage/session-store";
import { deserializeRatchetState } from "@/lib/crypto/double-ratchet";

export function useDeviceSync() {
  const [account, setAccount] = useState<Awaited<
    ReturnType<typeof loadAccount>
  > | null>(null);
  const [syncedMessages, setSyncedMessages] = useState<HistoryMessage[]>([]);
  const processedEventIds = useRef(new Set<string>());

  useEffect(() => {
    void (async () => {
      const resolvedAccount = await ensureSyncChannelKey();
      if (!resolvedAccount) return;

      setAccount(resolvedAccount);
      if (resolvedAccount.syncChannelKey) {
        setSyncedMessages(await loadMessageHistory());
      }
    })();
  }, []);

  const deviceConvexId = account?.convexDeviceId as Id<"devices"> | undefined;

  const { results: events } = usePaginatedQuery(
    api.deviceSync.listSyncEvents,
    deviceConvexId && account?.syncChannelKey
      ? { targetDeviceConvexId: deviceConvexId }
      : "skip",
    { initialNumItems: 50 },
  );

  useEffect(() => {
    if (!account?.syncChannelKey || !events?.length) return;

    async function processEvents() {
      const syncKey = fromBase64(account!.syncChannelKey!);
      for (const event of events!) {
        if (processedEventIds.current.has(event._id)) continue;
        processedEventIds.current.add(event._id);

        try {
          const payload = await decryptSyncEvent(
            syncKey,
            event.encryptedPayload,
          );
          if (payload.type === "message_copy") {
            const message: HistoryMessage = {
              conversationId: payload.conversationId,
              plaintext: payload.plaintext,
              timestamp: payload.timestamp,
              direction: payload.direction,
            };
            await appendMessageHistory(message);
            setSyncedMessages((prev) => {
              const exists = prev.some(
                (m) =>
                  m.timestamp === message.timestamp &&
                  m.plaintext === message.plaintext &&
                  m.direction === message.direction &&
                  m.conversationId === message.conversationId,
              );
              if (exists) return prev;
              return [...prev, message];
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
          processedEventIds.current.delete(event._id);
        }
      }
    }

    void processEvents();
  }, [events, account]);

  return { syncedMessages, account };
}
