import {
  createInitialMessage,
  createRatchetState,
  decryptInitialMessage,
  initRatchetAsInitiator,
  ratchetDecrypt,
  ratchetEncrypt,
  serializeRatchetState,
} from "../crypto/double-ratchet";
import type { EncryptedEnvelope, PreKeyBundle, RatchetState } from "../crypto/types";
import { randomBytes, toBase64 } from "../crypto/bytes";
import { generateKeyPair } from "../crypto/x25519";
import {
  createPreKeyBundle,
  performX3DHInitiator,
  performX3DHResponder,
  type LocalPreKeyStore,
} from "../crypto/x3dh";
import {
  createDeviceRecord,
  insertSession,
  promoteSession,
  updateActiveSession,
  type DeviceRecord,
} from "./device-record";

export interface SesameContext {
  localStore: LocalPreKeyStore;
  getDeviceRecord: (remoteDeviceId: string) => Promise<DeviceRecord | null>;
  saveDeviceRecord: (record: DeviceRecord) => Promise<void>;
}

function newSessionId(): string {
  return toBase64(randomBytes(16));
}

export async function encryptForDevice(
  ctx: SesameContext,
  remoteDeviceId: string,
  remoteBundle: PreKeyBundle,
  plaintext: string,
): Promise<{ envelopes: EncryptedEnvelope[]; record: DeviceRecord }> {
  let record =
    (await ctx.getDeviceRecord(remoteDeviceId)) ??
    createDeviceRecord(remoteDeviceId);

  if (record.activeSession) {
    const { state, envelope } = await ratchetEncrypt(
      record.activeSession.ratchetState,
      plaintext,
    );
    record = updateActiveSession(record, state);
    await ctx.saveDeviceRecord(record);
    return { envelopes: [envelope], record };
  }

  const ephemeralKey = generateKeyPair();
  const x3dh = performX3DHInitiator({
    identityKey: ctx.localStore.identity.identityKey,
    ephemeralKey,
    remoteBundle,
  });

  const remoteRatchetKey = remoteBundle.signedPreKey;
  let state = createRatchetState(x3dh.sharedSecret);
  state = initRatchetAsInitiator(state, remoteRatchetKey);

  const { state: newState, envelope } = await createInitialMessage(
    x3dh.sharedSecret,
    remoteRatchetKey,
    plaintext,
    ctx.localStore.identity.identityKey.publicKey,
    ephemeralKey,
    remoteBundle.signedPreKeyId,
    x3dh.usedOneTimePreKeyId,
  );

  record = insertSession(record, {
    id: newSessionId(),
    ratchetState: newState,
    createdAt: Date.now(),
  });
  await ctx.saveDeviceRecord(record);
  return { envelopes: [envelope], record };
}

export async function decryptFromDevice(
  ctx: SesameContext,
  remoteDeviceId: string,
  envelope: EncryptedEnvelope,
  localStore: LocalPreKeyStore,
): Promise<{ plaintext: string; record: DeviceRecord }> {
  let record =
    (await ctx.getDeviceRecord(remoteDeviceId)) ??
    createDeviceRecord(remoteDeviceId);

  if (envelope.messageType === "x3dh_initial") {
    const { fromBase64 } = await import("../crypto/bytes");
    const sharedSecret = performX3DHResponder({
      identityKey: localStore.identity.identityKey,
      signedPreKey: localStore.signedPreKey.keyPair,
      signedPreKeyId: localStore.signedPreKey.keyId,
      oneTimePreKey:
        envelope.oneTimePreKeyId !== undefined
          ? localStore.oneTimePreKeys.find(
              (k) => k.keyId === envelope.oneTimePreKeyId,
            )?.keyPair
          : undefined,
      oneTimePreKeyId: envelope.oneTimePreKeyId,
      remoteIdentityKey: fromBase64(envelope.identityKey!),
      remoteEphemeralKey: fromBase64(envelope.ephemeralKey!),
    });

    const baseState = createRatchetState(sharedSecret);
    const { state, plaintext } = await decryptInitialMessage(
      baseState,
      envelope,
      sharedSecret,
      localStore.signedPreKey.keyPair,
    );

    record = insertSession(record, {
      id: newSessionId(),
      ratchetState: state,
      createdAt: Date.now(),
    });
    await ctx.saveDeviceRecord(record);
    return { plaintext, record };
  }

  if (!record.activeSession) {
    throw new Error("No active session for device");
  }

  const { state, plaintext } = await ratchetDecrypt(
    record.activeSession.ratchetState,
    envelope,
  );

  record = updateActiveSession(record, state);
  await ctx.saveDeviceRecord(record);
  return { plaintext, record };
}

export function getActiveRatchetState(
  record: DeviceRecord,
): RatchetState | null {
  return record.activeSession?.ratchetState ?? null;
}

export function exportSessionState(record: DeviceRecord): string | null {
  if (!record.activeSession) return null;
  return JSON.stringify(serializeRatchetState(record.activeSession.ratchetState));
}

export { promoteSession, createDeviceRecord };
