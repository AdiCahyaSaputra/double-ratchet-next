import { randomBytes } from "./bytes";
import { KEY_LENGTH } from "./types";

const NONCE_LENGTH = 12;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function importKey(messageKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(messageKey),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptAead(
  messageKey: Uint8Array,
  plaintext: Uint8Array,
  associatedData: Uint8Array,
): Promise<Uint8Array> {
  const nonce = randomBytes(NONCE_LENGTH);
  const key = await importKey(messageKey);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(associatedData),
    },
    key,
    toArrayBuffer(plaintext),
  );
  const result = new Uint8Array(NONCE_LENGTH + ciphertext.byteLength);
  result.set(nonce, 0);
  result.set(new Uint8Array(ciphertext), NONCE_LENGTH);
  return result;
}

export async function decryptAead(
  messageKey: Uint8Array,
  data: Uint8Array,
  associatedData: Uint8Array,
): Promise<Uint8Array> {
  const nonce = data.slice(0, NONCE_LENGTH);
  const ciphertext = data.slice(NONCE_LENGTH);
  const key = await importKey(messageKey);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(associatedData),
    },
    key,
    toArrayBuffer(ciphertext),
  );
  return new Uint8Array(plaintext);
}

export { KEY_LENGTH };
