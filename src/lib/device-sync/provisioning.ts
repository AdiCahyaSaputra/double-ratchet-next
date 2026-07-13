import { concat, fromBase64, randomBytes, toBase64 } from "../crypto/bytes";
import { encryptAead, decryptAead } from "../crypto/aes-gcm";
import { generateKeyPair, getSharedSecret } from "../crypto/x25519";
import { hkdfSha256DefaultSalt } from "../crypto/hkdf";
import type { KeyPair } from "../crypto/types";

export interface ProvisioningPayload {
  provisioningId: string;
  ephemeralPublicKey: string;
  deviceName: string;
}

export interface ProvisioningQRData {
  provisioningId: string;
  ephemeralPublicKey: string;
  deviceName: string;
}

export interface ProvisioningMessage {
  accountId: string;
  username: string;
  syncChannelKey: string;
  archiveKey?: string;
  primaryDeviceId: string;
}

export function createProvisioningRequest(deviceName: string): {
  ephemeralKey: KeyPair;
  payload: ProvisioningQRData;
} {
  const ephemeralKey = generateKeyPair();
  const provisioningId = toBase64(randomBytes(16));
  return {
    ephemeralKey,
    payload: {
      provisioningId,
      ephemeralPublicKey: toBase64(ephemeralKey.publicKey),
      deviceName,
    },
  };
}

export function deriveSyncChannelKey(
  ephemeralPrivateKey: Uint8Array,
  remoteEphemeralPublicKey: Uint8Array,
): Uint8Array {
  const dh = getSharedSecret(ephemeralPrivateKey, remoteEphemeralPublicKey);
  return hkdfSha256DefaultSalt(dh, "DeviceSyncChannel", 32);
}

export async function encryptProvisioningMessage(
  primaryEphemeralPrivateKey: Uint8Array,
  linkedEphemeralPublicKey: Uint8Array,
  primaryEphemeralPublicKey: Uint8Array,
  message: ProvisioningMessage,
): Promise<{ encryptedPayload: string; primaryEphemeralPublicKey: string }> {
  const syncKey = deriveSyncChannelKey(
    primaryEphemeralPrivateKey,
    linkedEphemeralPublicKey,
  );
  const plaintext = new TextEncoder().encode(JSON.stringify(message));
  const ciphertext = await encryptAead(syncKey, plaintext, new Uint8Array(0));
  return {
    encryptedPayload: toBase64(ciphertext),
    primaryEphemeralPublicKey: toBase64(primaryEphemeralPublicKey),
  };
}

export async function decryptProvisioningMessage(
  linkedEphemeralPrivateKey: Uint8Array,
  primaryEphemeralPublicKey: Uint8Array,
  encryptedPayload: string,
): Promise<ProvisioningMessage> {
  const syncKey = deriveSyncChannelKey(
    linkedEphemeralPrivateKey,
    primaryEphemeralPublicKey,
  );
  const plaintext = await decryptAead(
    syncKey,
    fromBase64(encryptedPayload),
    new Uint8Array(0),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as ProvisioningMessage;
}

export function encodeQRData(data: ProvisioningQRData): string {
  return JSON.stringify(data);
}

export function decodeQRData(encoded: string): ProvisioningQRData {
  return JSON.parse(encoded) as ProvisioningQRData;
}

export function generateArchiveKey(): Uint8Array {
  return randomBytes(32);
}
