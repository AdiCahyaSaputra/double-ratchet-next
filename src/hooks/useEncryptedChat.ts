"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { fromBase64 } from "@/lib/crypto/bytes";
import type { EncryptedEnvelope, PreKeyBundle } from "@/lib/crypto/types";
import { ensureIdentityStore } from "@/lib/storage/identity-store";
import { loadAccount } from "@/lib/storage/account-store";
import { decryptMessage, encryptToUser } from "@/lib/storage/crypto-service";
import type { ChatMessage } from "@/components/ChatWindow";
import { encryptSyncEvent } from "@/lib/device-sync/sync-channel";
import type { LocalPreKeyStore } from "@/lib/crypto/x3dh";

function messageDedupeKey(
  text: string,
  timestamp: number,
  senderDeviceId: string,
): string {
  return `${senderDeviceId}:${timestamp}:${text}`;
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
        loadAccount(),
      ]);
      setLocalStore(identity);
      setAccount(acct);
    }
    void init();
  }, []);

  const deviceIdMap = useMemo(() => {
    if (!peerDevices) return new Map<string, string>();
    return new Map(peerDevices.map((d) => [d._id, d.deviceId]));
  }, [peerDevices]);

  useEffect(() => {
    if (!localStore || !account || !incoming || !peerDevices) return;

    async function decryptAll() {
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
        } catch {
          // skip undecryptable
        }
      }

      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setDecrypted((prev) => {
        const own = prev.filter((m) => m.isOwn);
        const combined = [...msgs, ...own];
        combined.sort((a, b) => a.timestamp - b.timestamp);
        return combined;
      });
    }

    void decryptAll();
  }, [incoming, localStore, account, peerDevices, deviceIdMap]);

  const send = useCallback(
    async (text: string) => {
      if (!localStore || !account || !peerDevices?.length) return;
      setSending(true);
      setError(null);
      try {
        const remoteDevices = await Promise.all(
          peerDevices.map(async (d) => {
            const bundleWire = await fetchBundle(d._id);
            return {
              deviceId: d.deviceId,
              convexDeviceId: d._id,
              preKeyBundle: bundleWire,
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

        if (account.isPrimary && account.syncChannelKey && ownDevices) {
          const syncKey = fromBase64(account.syncChannelKey);
          const payload = await encryptSyncEvent(syncKey, {
            type: "message_copy",
            conversationId: peerUsername,
            plaintext: text,
            timestamp: now,
            direction: "sent",
          });
          const linked = ownDevices.filter(
            (d) => !d.isPrimary && d._id !== account.convexDeviceId,
          );
          for (const target of linked) {
            await pushSync({
              sourceDeviceId: localStore.deviceId,
              sourceDeviceConvexId: account.convexDeviceId as Id<"devices">,
              targetDeviceConvexId: target._id,
              encryptedPayload: payload,
            });
          }
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

async function fetchBundle(
  deviceConvexId: string,
): Promise<PreKeyBundle> {
  const { ConvexHttpClient } = await import("convex/browser");
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const bundle = await client.query(api.prekeys.getBundle, {
    deviceConvexId: deviceConvexId as Id<"devices">,
  });
  if (!bundle) throw new Error("Prekey bundle not found");
  return {
    registrationId: bundle.registrationId,
    identityKey: fromBase64(bundle.identityPublicKey),
    signedPreKeyId: bundle.signedPreKeyId,
    signedPreKey: fromBase64(bundle.signedPreKeyPublic),
    signedPreKeySignature: fromBase64(bundle.signedPreKeySignature),
    oneTimePreKeyId: bundle.oneTimePreKeyId,
    oneTimePreKey: bundle.oneTimePreKeyPublic
      ? fromBase64(bundle.oneTimePreKeyPublic)
      : undefined,
  };
}
