import { fromBase64, toBase64 } from "../crypto/bytes";
import { encryptAead, decryptAead } from "../crypto/aes-gcm";
import type { SerializedRatchetState } from "../crypto/types";

export type SyncEvent =
  | {
      type: "session_state";
      remoteDeviceId: string;
      ratchetState: SerializedRatchetState;
    }
  | {
      type: "message_copy";
      conversationId: string;
      plaintext: string;
      timestamp: number;
      direction: "sent" | "received";
    }
  | { type: "device_added"; deviceId: string; deviceName: string };

export async function encryptSyncEvent(
  syncChannelKey: Uint8Array,
  event: SyncEvent,
): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(event));
  const ciphertext = await encryptAead(syncChannelKey, plaintext, new Uint8Array(0));
  return toBase64(ciphertext);
}

export async function decryptSyncEvent(
  syncChannelKey: Uint8Array,
  encryptedPayload: string,
): Promise<SyncEvent> {
  const plaintext = await decryptAead(
    syncChannelKey,
    fromBase64(encryptedPayload),
    new Uint8Array(0),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as SyncEvent;
}
