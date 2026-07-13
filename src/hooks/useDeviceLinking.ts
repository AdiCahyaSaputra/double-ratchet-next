"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  createProvisioningRequest,
  decodeQRData,
  decryptProvisioningMessage,
  encryptProvisioningMessage,
  generateArchiveKey,
  type ProvisioningQRData,
} from "@/lib/device-sync/provisioning";
import { buildSyncArchive } from "@/lib/device-sync/sync-archive";
import { serializeRatchetState } from "@/lib/crypto/double-ratchet";
import { toBase64, fromBase64 } from "@/lib/crypto/bytes";
import { generateKeyPair } from "@/lib/crypto/x25519";
import { ensureIdentityStore } from "@/lib/storage/identity-store";
import { loadAccount, saveAccount, updateSyncChannelKey } from "@/lib/storage/account-store";
import { clearPendingAuth } from "@/lib/auth/pending-auth";
import { createPreKeyBundle } from "@/lib/crypto/x3dh";
import { listAllDeviceRecords } from "@/lib/storage/session-store";
import type { SyncStatus } from "@/components/SyncProgress";

export function useDeviceLinking() {
  const [qrPayload, setQrPayload] = useState<ProvisioningQRData | null>(null);
  const ephemeralRef = useRef<ReturnType<typeof createProvisioningRequest> | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  const createRequest = useMutation(api.provisioning.createRequest);
  const sendProvisioning = useMutation(api.provisioning.sendProvisioningMessage);
  const linkDevice = useMutation(api.devices.linkDevice);
  const uploadArchive = useMutation(api.deviceSync.uploadSyncArchive);
  const getProvisioningMsg = useQuery(
    api.provisioning.getProvisioningMessage,
    qrPayload ? { provisioningId: qrPayload.provisioningId } : "skip",
  );
  const getArchive = useQuery(
    api.deviceSync.getSyncArchive,
    qrPayload ? { provisioningId: qrPayload.provisioningId } : "skip",
  );

  const startLinking = useCallback(async (deviceName: string) => {
    const req = createProvisioningRequest(deviceName);
    ephemeralRef.current = req;
    setQrPayload(req.payload);
    await createRequest({
      provisioningId: req.payload.provisioningId,
      ephemeralPublicKey: req.payload.ephemeralPublicKey,
      deviceName: req.payload.deviceName,
    });
  }, [createRequest]);

  const completeLinkAsPrimary = useCallback(
    async (qrData: string, withSync = true) => {
      const account = await loadAccount();
      if (!account?.isPrimary) throw new Error("Primary device required");

      const payload = decodeQRData(qrData);
      const primaryEphemeral = generateKeyPair();
      const archiveKey = withSync ? generateArchiveKey() : undefined;
      const syncChannelKey = toBase64(
        (await import("@/lib/device-sync/provisioning")).deriveSyncChannelKey(
          primaryEphemeral.privateKey,
          fromBase64(payload.ephemeralPublicKey),
        ),
      );

      const { encryptedPayload, primaryEphemeralPublicKey } =
        await encryptProvisioningMessage(
          primaryEphemeral.privateKey,
          fromBase64(payload.ephemeralPublicKey),
          primaryEphemeral.publicKey,
          {
            accountId: account.accountId,
            username: account.username,
            syncChannelKey,
            archiveKey: archiveKey ? toBase64(archiveKey) : undefined,
            primaryDeviceId: account.linkedDevices[0]?.deviceId ?? "",
          },
        );

      await sendProvisioning({
        provisioningId: payload.provisioningId,
        primaryEphemeralPublicKey,
        encryptedPayload,
        primaryDeviceId: (await ensureIdentityStore()).deviceId,
        primaryDeviceConvexId: account.convexDeviceId as Id<"devices">,
      });

      if (withSync && archiveKey) {
        setSyncStatus("uploading");
        const sessions = await listAllDeviceRecords();
        const archive = await buildSyncArchive(archiveKey, {
          sessions: sessions.map((s) => ({
            remoteDeviceId: s.remoteDeviceId,
            activeSession: s.activeSession
              ? {
                  id: s.activeSession.id,
                  ratchetState: serializeRatchetState(
                    s.activeSession.ratchetState,
                  ),
                  createdAt: s.activeSession.createdAt,
                }
              : null,
            inactiveSessions: [],
          })),
          messages: [],
        });
        await uploadArchive({
          provisioningId: payload.provisioningId,
          encryptedArchive: archive,
          primaryDeviceId: (await ensureIdentityStore()).deviceId,
          primaryDeviceConvexId: account.convexDeviceId as Id<"devices">,
        });
        setSyncStatus("complete");
      }
    },
    [sendProvisioning, uploadArchive],
  );

  useEffect(() => {
    if (!qrPayload || !getProvisioningMsg || !ephemeralRef.current) return;

    async function finishLinking() {
      try {
        setSyncStatus("downloading");
        const identity = await ensureIdentityStore();
        const msg = await decryptProvisioningMessage(
          ephemeralRef.current!.ephemeralKey.privateKey,
          fromBase64(getProvisioningMsg!.primaryEphemeralPublicKey),
          getProvisioningMsg!.encryptedPayload,
        );

        const bundle = createPreKeyBundle(identity, true);
        const deviceConvexId = await linkDevice({
          provisioningId: qrPayload!.provisioningId,
          deviceId: identity.deviceId,
          identityPublicKey: toBase64(identity.identity.identityKey.publicKey),
          signingPublicKey: toBase64(identity.identity.signingKey.publicKey),
          registrationId: identity.identity.registrationId,
          signedPreKeyId: identity.signedPreKey.keyId,
          signedPreKeyPublic: toBase64(identity.signedPreKey.keyPair.publicKey),
          signedPreKeySignature: toBase64(identity.signedPreKey.signature),
          oneTimePreKeys: identity.oneTimePreKeys.map((opk) => ({
            keyId: opk.keyId,
            publicKey: toBase64(opk.keyPair.publicKey),
          })),
          accountId: msg.accountId as Id<"accounts">,
          deviceName: qrPayload!.deviceName,
        });

        await saveAccount({
          accountId: msg.accountId,
          username: msg.username,
          convexDeviceId: deviceConvexId,
          isPrimary: false,
          syncChannelKey: msg.syncChannelKey,
          linkedDevices: [],
        });
        await updateSyncChannelKey(msg.syncChannelKey);

        if (msg.archiveKey && getArchive) {
          const { restoreSyncArchive } = await import(
            "@/lib/device-sync/sync-archive"
          );
          const { importDeviceRecord } = await import(
            "@/lib/storage/session-store"
          );
          const { deserializeRatchetState } = await import(
            "@/lib/crypto/double-ratchet"
          );
          const content = await restoreSyncArchive(
            fromBase64(msg.archiveKey),
            getArchive,
          );
          for (const session of content.sessions) {
            if (session.activeSession) {
              await importDeviceRecord({
                remoteDeviceId: session.remoteDeviceId,
                activeSession: {
                  id: session.activeSession.id,
                  ratchetState: deserializeRatchetState(
                    session.activeSession.ratchetState,
                  ),
                  createdAt: session.activeSession.createdAt,
                },
                inactiveSessions: [],
              });
            }
          }
        }
        clearPendingAuth();
        setSyncStatus("complete");
      } catch {
        setSyncStatus("error");
      }
    }

    void finishLinking();
  }, [getProvisioningMsg, getArchive, qrPayload, linkDevice]);

  return {
    qrPayload,
    startLinking,
    completeLinkAsPrimary,
    syncStatus,
  };
}
