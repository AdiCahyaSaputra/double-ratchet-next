import type { EncryptedEnvelope } from "../crypto/types";
import type { LocalPreKeyStore } from "../crypto/x3dh";
import { createPreKeyBundle } from "../crypto/x3dh";
import { fanoutEncrypt, type RemoteDevice } from "../sesame/fanout";
import { decryptFromDevice, encryptForDevice, type SesameContext } from "../sesame/sesame";
import {
  getDeviceRecord,
  saveDeviceRecord,
  trackDeviceRecord,
} from "./session-store";
import { encryptSyncEvent, type SyncEvent } from "../device-sync/sync-channel";
import { loadAccount } from "./account-store";

export function createSesameContext(
  localStore: LocalPreKeyStore,
): SesameContext {
  return {
    localStore,
    getDeviceRecord: async (remoteDeviceId) => {
      const record = await getDeviceRecord(remoteDeviceId);
      if (record) await trackDeviceRecord(remoteDeviceId);
      return record;
    },
    saveDeviceRecord: async (record) => {
      await saveDeviceRecord(record);
      await trackDeviceRecord(record.remoteDeviceId);
    },
  };
}

export function getLocalPreKeyBundle(
  localStore: LocalPreKeyStore,
): ReturnType<typeof createPreKeyBundle> {
  return createPreKeyBundle(localStore, true);
}

export async function encryptToUser(
  localStore: LocalPreKeyStore,
  remoteDevices: RemoteDevice[],
  plaintext: string,
): Promise<Array<{ convexDeviceId: string; envelope: EncryptedEnvelope }>> {
  const ctx = createSesameContext(localStore);
  const results = await fanoutEncrypt(ctx, remoteDevices, plaintext);
  return results.map((r) => ({
    convexDeviceId: r.convexDeviceId,
    envelope: r.envelope,
  }));
}

export async function decryptMessage(
  localStore: LocalPreKeyStore,
  remoteDeviceId: string,
  envelope: EncryptedEnvelope,
): Promise<string> {
  const ctx = createSesameContext(localStore);
  const { plaintext } = await decryptFromDevice(
    ctx,
    remoteDeviceId,
    envelope,
    localStore,
  );
  return plaintext;
}

export async function syncToLinkedDevices(event: SyncEvent): Promise<void> {
  const account = await loadAccount();
  if (!account?.syncChannelKey || !account.isPrimary) return;
  const { fromBase64, toBase64 } = await import("../crypto/bytes");
  const syncKey = fromBase64(account.syncChannelKey);
  await encryptSyncEvent(syncKey, event);
  // Actual push happens via Convex mutation in the hook
}

export { encryptForDevice, decryptFromDevice };
