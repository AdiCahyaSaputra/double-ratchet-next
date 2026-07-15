"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { fromBase64 } from "@/lib/crypto/bytes";
import type { EncryptedEnvelope, PreKeyBundle } from "@/lib/crypto/types";
import { ensureIdentityStore } from "@/lib/storage/identity-store";
import { loadAccount } from "@/lib/storage/account-store";
import { ensureSyncChannelKey } from "@/lib/device-sync/ensure-sync-channel-key";
import { decryptMessage, encryptToUser } from "@/lib/storage/crypto-service";
import {
  appendMessageHistory,
  loadMessageHistory,
  type HistoryMessage,
} from "@/lib/storage/message-history-store";
import type { ChatMessage } from "@/components/ChatWindow";
import { encryptSyncEvent } from "@/lib/device-sync/sync-channel";
import { verifySignedPreKey, type LocalPreKeyStore } from "@/lib/crypto/x3dh";

function messageDedupeKey(
  text: string,
  timestamp: number,
  senderDeviceId: string,
): string {
  return `${senderDeviceId}:${timestamp}:${text}`;
}

function chatMessageDedupeKey(msg: ChatMessage): string {
  return `${msg.isOwn}:${msg.timestamp}:${msg.text}`;
}

async function pushMessageCopyToSiblings(
  account: NonNullable<Awaited<ReturnType<typeof loadAccount>>>,
  ownDevices: Array<{ _id: Id<"devices"> }>,
  localStore: LocalPreKeyStore & { deviceId: string },
  pushSync: (args: {
    sourceDeviceId: string;
    sourceDeviceConvexId: Id<"devices">;
    targetDeviceConvexId: Id<"devices">;
    encryptedPayload: string;
  }) => Promise<unknown>,
  message: HistoryMessage,
): Promise<void> {
  if (!account.syncChannelKey) return;

  const syncKey = fromBase64(account.syncChannelKey);
  const payload = await encryptSyncEvent(syncKey, {
    type: "message_copy",
    conversationId: message.conversationId,
    plaintext: message.plaintext,
    timestamp: message.timestamp,
    direction: message.direction,
  });

  const siblings = ownDevices.filter(
    (d) => d._id !== (account.convexDeviceId as Id<"devices">),
  );
  for (const target of siblings) {
    await pushSync({
      sourceDeviceId: localStore.deviceId,
      sourceDeviceConvexId: account.convexDeviceId as Id<"devices">,
      targetDeviceConvexId: target._id,
      encryptedPayload: payload,
    });
  }
}

export function useEncryptedChat(peerUsername: string) {
  const [localStore, setLocalStore] = useState<
    (LocalPreKeyStore & { deviceId: string }) | null
  >(null);
  const [account, setAccount] = useState<Awaited<
    ReturnType<typeof loadAccount>
  > | null>(null);
  const [decrypted, setDecrypted] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedIncomingIds = useRef(new Set<string>());
  const pushedHistoryPeers = useRef(new Set<string>());

  const peerDevices = useQuery(api.devices.listDevicesByUsername, {
    username: peerUsername,
  });
  const ownDevices = useQuery(
    api.devices.listDevicesForAccount,
    account?.accountId
      ? { accountId: account.accountId as Id<"accounts"> }
      : "skip",
  );
  const sendMessage = useMutation(api.messages.send);
  const consumeOpk = useMutation(api.prekeys.consumeOneTimePreKey);
  const pushSync = useMutation(api.deviceSync.pushSyncEvent);

  const deviceConvexId = account?.convexDeviceId as Id<"devices"> | undefined;

  const { results: incoming } = usePaginatedQuery(
    api.messages.listForDevice,
    deviceConvexId ? { recipientDeviceConvexId: deviceConvexId } : "skip",
    { initialNumItems: 50 },
  );

  useEffect(() => {
    async function init() {
      const [identity, acct] = await Promise.all([
        ensureIdentityStore(),
        ensureSyncChannelKey(),
      ]);
      setLocalStore(identity);
      setAccount(acct);
    }
    void init();
  }, []);

  useEffect(() => {
    if (!account?.syncChannelKey || !ownDevices || !localStore) return;
    if (pushedHistoryPeers.current.has(peerUsername)) return;
    pushedHistoryPeers.current.add(peerUsername);

    void (async () => {
      const history = await loadMessageHistory();
      const forPeer = history.filter((m) => m.conversationId === peerUsername);
      for (const entry of forPeer) {
        await pushMessageCopyToSiblings(
          account,
          ownDevices,
          localStore,
          pushSync,
          entry,
        );
      }
    })();
  }, [account, ownDevices, localStore, peerUsername, pushSync]);

  useEffect(() => {
    if (!account) return;

    void loadMessageHistory().then((history) => {
      const forPeer = history
        .filter((m) => m.conversationId === peerUsername)
        .map((m) => ({
          id: `hist-${m.timestamp}-${m.direction}`,
          text: m.plaintext,
          isOwn: m.direction === "sent",
          timestamp: m.timestamp,
        }));

      setDecrypted((prev) => {
        const seen = new Set(prev.map(chatMessageDedupeKey));
        const merged = [...prev];
        for (const msg of forPeer) {
          const key = chatMessageDedupeKey(msg);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(msg);
        }
        merged.sort((a, b) => a.timestamp - b.timestamp);
        return merged;
      });
    });
  }, [account, peerUsername]);

  const deviceIdMap = useMemo(() => {
    if (!peerDevices) return new Map<string, string>();
    return new Map(peerDevices.map((d) => [d._id, d.deviceId]));
  }, [peerDevices]);

  useEffect(() => {
    if (!localStore || !account || !incoming || !peerDevices || !ownDevices)
      return;

    async function decryptAll() {
      const currentAccount = account!;
      const seen = new Set<string>();
      const msgs: ChatMessage[] = [];

      for (const raw of incoming) {
        try {
          const envelope = JSON.parse(raw.envelope) as EncryptedEnvelope;
          const senderClientId = deviceIdMap.get(raw.senderDeviceId);
          if (!senderClientId) continue;

          const plaintext = await decryptMessage(
            localStore!,
            senderClientId,
            envelope,
          );

          const key = messageDedupeKey(
            plaintext,
            raw.createdAt,
            raw.senderDeviceId,
          );
          if (seen.has(key)) continue;
          seen.add(key);

          msgs.push({
            id: raw._id,
            text: plaintext,
            isOwn: false,
            timestamp: raw.createdAt,
          });

          const historyEntry: HistoryMessage = {
            conversationId: peerUsername,
            plaintext,
            timestamp: raw.createdAt,
            direction: "received",
          };

          if (!syncedIncomingIds.current.has(raw._id)) {
            syncedIncomingIds.current.add(raw._id);
            await appendMessageHistory(historyEntry);

            if (currentAccount.syncChannelKey) {
              await pushMessageCopyToSiblings(
                currentAccount,
                ownDevices!,
                localStore!,
                pushSync,
                historyEntry,
              );
            }
          }
        } catch {
          // skip undecryptable
        }
      }

      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setDecrypted((prev) => {
        const own = prev.filter((m) => m.isOwn);
        const combined = [...msgs, ...own];
        const deduped = combined.filter(
          (msg, i, arr) =>
            arr.findIndex((m) => chatMessageDedupeKey(m) === chatMessageDedupeKey(msg)) ===
            i,
        );
        deduped.sort((a, b) => a.timestamp - b.timestamp);
        return deduped;
      });
    }

    void decryptAll();
  }, [
    incoming,
    localStore,
    account,
    peerDevices,
    ownDevices,
    deviceIdMap,
    peerUsername,
    pushSync,
  ]);

  const send = useCallback(
    async (text: string) => {
      if (!localStore || !account || !peerDevices?.length) return;
      setSending(true);
      setError(null);
      try {
        const remoteDevices = await Promise.all(
          peerDevices.map(async (d) => {
            const { bundle, signingPublicKey } = await fetchBundle(d._id);

            const isVerified = verifySignedPreKey(
              bundle.identityKey,
              bundle.signedPreKey,
              bundle.signedPreKeySignature,
              signingPublicKey,
            );

            if (!isVerified) {
              throw new Error("Signed pre key verification failed");
            }

            return {
              deviceId: d.deviceId,
              convexDeviceId: d._id,
              preKeyBundle: bundle,
            };
          }),
        );

        const envelopes = await encryptToUser(localStore, remoteDevices, text);

        for (const { convexDeviceId, envelope } of envelopes) {
          await sendMessage({
            senderDeviceId: localStore.deviceId,
            senderDeviceConvexId: account.convexDeviceId as Id<"devices">,
            recipientDeviceConvexId: convexDeviceId as Id<"devices">,
            envelope: JSON.stringify(envelope),
          });

          if (envelope.oneTimePreKeyId !== undefined) {
            await consumeOpk({
              deviceConvexId: convexDeviceId as Id<"devices">,
              keyId: envelope.oneTimePreKeyId,
            });
          }
        }

        const now = Date.now();
        setDecrypted((prev) => [
          ...prev,
          {
            id: `local-${now}`,
            text,
            isOwn: true,
            timestamp: now,
          },
        ]);

        const historyEntry: HistoryMessage = {
          conversationId: peerUsername,
          plaintext: text,
          timestamp: now,
          direction: "sent",
        };
        void appendMessageHistory(historyEntry);

        if (account.syncChannelKey && ownDevices) {
          await pushMessageCopyToSiblings(
            account,
            ownDevices,
            localStore,
            pushSync,
            historyEntry,
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Send failed");
      } finally {
        setSending(false);
      }
    },
    [
      localStore,
      account,
      peerDevices,
      peerUsername,
      sendMessage,
      consumeOpk,
      pushSync,
      ownDevices,
    ],
  );

  return { messages: decrypted, send, sending, error, account, localStore };
}

async function fetchBundle(deviceConvexId: string): Promise<{
  bundle: PreKeyBundle;
  signingPublicKey: Uint8Array;
}> {
  const { ConvexHttpClient } = await import("convex/browser");
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const bundle = await client.query(api.prekeys.getBundle, {
    deviceConvexId: deviceConvexId as Id<"devices">,
  });
  if (!bundle) throw new Error("Prekey bundle not found");
  return {
    bundle: {
      registrationId: bundle.registrationId,
      identityKey: fromBase64(bundle.identityPublicKey),
      signedPreKeyId: bundle.signedPreKeyId,
      signedPreKey: fromBase64(bundle.signedPreKeyPublic),
      signedPreKeySignature: fromBase64(bundle.signedPreKeySignature),
      oneTimePreKeyId: bundle.oneTimePreKeyId,
      oneTimePreKey: bundle.oneTimePreKeyPublic
        ? fromBase64(bundle.oneTimePreKeyPublic)
        : undefined,
    },
    signingPublicKey: fromBase64(bundle.signingPublicKey),
  };
}
