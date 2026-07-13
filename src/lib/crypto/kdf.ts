import { hkdfSha256 } from "./hkdf";
import { KEY_LENGTH } from "./types";

export function kdfRk(
  rootKey: Uint8Array,
  dhOutput: Uint8Array,
): [Uint8Array, Uint8Array] {
  const output = hkdfSha256(dhOutput, rootKey, "DoubleRatchet_RK", KEY_LENGTH * 2);
  return [output.slice(0, KEY_LENGTH), output.slice(KEY_LENGTH)];
}

export function kdfCk(
  chainKey: Uint8Array,
): [Uint8Array, Uint8Array] {
  const zeroInput = new Uint8Array(0);
  const output = hkdfSha256(zeroInput, chainKey, "DoubleRatchet_CK", KEY_LENGTH * 2);
  return [output.slice(0, KEY_LENGTH), output.slice(KEY_LENGTH)];
}
