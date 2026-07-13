import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { KEY_LENGTH } from "./types";

const ZERO_SALT = new Uint8Array(KEY_LENGTH);

export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  length: number,
): Uint8Array {
  const infoBytes = new TextEncoder().encode(info);
  return hkdf(sha256, ikm, salt, infoBytes, length);
}

export function hkdfSha256DefaultSalt(
  ikm: Uint8Array,
  info: string,
  length: number,
): Uint8Array {
  return hkdfSha256(ikm, ZERO_SALT, info, length);
}
