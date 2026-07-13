import { fromBase64, toBase64 } from "./bytes";
import type { RatchetHeader } from "./types";

export function serializeHeader(header: RatchetHeader): Uint8Array {
  const json = JSON.stringify({
    dh_public_key: toBase64(header.dhPublicKey),
    previous_chain_length: header.previousChainLength,
    message_number: header.messageNumber,
  });
  return new TextEncoder().encode(json);
}

export function deserializeHeader(data: Uint8Array): RatchetHeader {
  const json = JSON.parse(new TextDecoder().decode(data)) as {
    dh_public_key: string;
    previous_chain_length: number;
    message_number: number;
  };
  return {
    dhPublicKey: fromBase64(json.dh_public_key),
    previousChainLength: json.previous_chain_length,
    messageNumber: json.message_number,
  };
}

export function serializeHeaderBase64(header: RatchetHeader): string {
  return toBase64(serializeHeader(header));
}

export function deserializeHeaderBase64(base64: string): RatchetHeader {
  return deserializeHeader(fromBase64(base64));
}
