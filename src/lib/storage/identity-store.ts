import { get, set, del, createStore } from "idb-keyval";
import type { LocalPreKeyStore } from "../crypto/x3dh";
import { generateLocalPreKeyStore } from "../crypto/x3dh";
import { toBase64, fromBase64 } from "../crypto/bytes";
import type { KeyPair } from "../crypto/types";

// Separate DB name per store — idb-keyval createStore only creates its
// object store on first DB open, so sharing one DB across stores leaves
// later stores missing.
const store = createStore("double-ratchet-identity", "keyval");

const IDENTITY_KEY = "identity-store";

interface SerializedKeyPair {
  publicKey: string;
  privateKey: string;
}

interface SerializedIdentityStore {
  identity: {
    identityKey: SerializedKeyPair;
    signingKey: SerializedKeyPair;
    registrationId: number;
  };
  signedPreKey: {
    keyId: number;
    keyPair: SerializedKeyPair;
    signature: string;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    keyPair: SerializedKeyPair;
  }>;
  deviceId: string;
}

function serializeKeyPair(kp: KeyPair): SerializedKeyPair {
  return { publicKey: toBase64(kp.publicKey), privateKey: toBase64(kp.privateKey) };
}

function deserializeKeyPair(kp: SerializedKeyPair): KeyPair {
  return { publicKey: fromBase64(kp.publicKey), privateKey: fromBase64(kp.privateKey) };
}

export function generateDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function loadIdentityStore(): Promise<
  (LocalPreKeyStore & { deviceId: string }) | null
> {
  const data = await get<SerializedIdentityStore>(IDENTITY_KEY, store);
  if (!data) return null;
  return {
    deviceId: data.deviceId,
    identity: {
      identityKey: deserializeKeyPair(data.identity.identityKey),
      signingKey: deserializeKeyPair(data.identity.signingKey),
      registrationId: data.identity.registrationId,
    },
    signedPreKey: {
      keyId: data.signedPreKey.keyId,
      keyPair: deserializeKeyPair(data.signedPreKey.keyPair),
      signature: fromBase64(data.signedPreKey.signature),
    },
    oneTimePreKeys: data.oneTimePreKeys.map((opk) => ({
      keyId: opk.keyId,
      keyPair: deserializeKeyPair(opk.keyPair),
    })),
  };
}

export async function saveIdentityStore(
  localStore: LocalPreKeyStore,
  deviceId: string,
): Promise<void> {
  const data: SerializedIdentityStore = {
    deviceId,
    identity: {
      identityKey: serializeKeyPair(localStore.identity.identityKey),
      signingKey: serializeKeyPair(localStore.identity.signingKey),
      registrationId: localStore.identity.registrationId,
    },
    signedPreKey: {
      keyId: localStore.signedPreKey.keyId,
      keyPair: serializeKeyPair(localStore.signedPreKey.keyPair),
      signature: toBase64(localStore.signedPreKey.signature),
    },
    oneTimePreKeys: localStore.oneTimePreKeys.map((opk) => ({
      keyId: opk.keyId,
      keyPair: serializeKeyPair(opk.keyPair),
    })),
  };
  await set(IDENTITY_KEY, data, store);
}

export async function ensureIdentityStore(): Promise<
  LocalPreKeyStore & { deviceId: string }
> {
  const existing = await loadIdentityStore();
  if (existing) return existing;
  const deviceId = generateDeviceId();
  const localStore = generateLocalPreKeyStore();
  await saveIdentityStore(localStore, deviceId);
  return { ...localStore, deviceId };
}

export async function clearIdentityStore(): Promise<void> {
  await del(IDENTITY_KEY, store);
}
