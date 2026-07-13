export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface PreKeyBundle {
  registrationId: number;
  identityKey: Uint8Array;
  signedPreKeyId: number;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  oneTimePreKeyId?: number;
  oneTimePreKey?: Uint8Array;
}

export interface RatchetHeader {
  dhPublicKey: Uint8Array;
  previousChainLength: number;
  messageNumber: number;
}

export interface RatchetState {
  dhs: KeyPair | null; // DH Sender
  dhr: Uint8Array | null; // DH Recipient
  rk: Uint8Array; // Top level KDF Root Key
  cks: Uint8Array | null; // Chain Key for Sending
  ckr: Uint8Array | null; // Chain Key for Receiving
  ns: number; // Sending Message Number
  nr: number; // Receiving Message Number
  pn: number; // Previous Chain Length
  skippedMessageKeys: Map<string, Uint8Array>;
}

export interface EncryptedEnvelope {
  header: string;
  ciphertext: string;
  messageType: "x3dh_initial" | "ratchet";
  identityKey?: string;
  ephemeralKey?: string;
  signedPreKeyId?: number;
  oneTimePreKeyId?: number;
}

export interface SerializedRatchetState {
  dhsPublic: string | null;
  dhsPrivate: string | null;
  dhr: string | null;
  rk: string;
  cks: string | null;
  ckr: string | null;
  ns: number;
  nr: number;
  pn: number;
  skippedMessageKeys: Array<[string, string]>;
}

export const KEY_LENGTH = 32;
export const MAX_SKIP = 128;
