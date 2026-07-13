import { fromBase64, toBase64 } from "../crypto/bytes";
import { encryptAead, decryptAead } from "../crypto/aes-gcm";
import type { SerializedDeviceRecord } from "../sesame/device-record";

export interface SyncArchiveContent {
  sessions: SerializedDeviceRecord[];
  messages: Array<{
    conversationId: string;
    plaintext: string;
    timestamp: number;
    direction: "sent" | "received";
  }>;
}

export async function buildSyncArchive(
  archiveKey: Uint8Array,
  content: SyncArchiveContent,
): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  const ciphertext = await encryptAead(archiveKey, plaintext, new Uint8Array(0));
  return toBase64(ciphertext);
}

export async function restoreSyncArchive(
  archiveKey: Uint8Array,
  encryptedArchive: string,
): Promise<SyncArchiveContent> {
  const plaintext = await decryptAead(
    archiveKey,
    fromBase64(encryptedArchive),
    new Uint8Array(0),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as SyncArchiveContent;
}
