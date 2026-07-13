import { decryptAead, encryptAead } from "./aes-gcm";
import { fromBase64, toBase64 } from "./bytes";
import { kdfCk, kdfRk } from "./kdf";
import {
  deserializeHeaderBase64,
  serializeHeader,
  serializeHeaderBase64,
} from "./serialize";
import type {
  EncryptedEnvelope,
  KeyPair,
  RatchetHeader,
  RatchetState,
  SerializedRatchetState,
} from "./types";
import { MAX_SKIP } from "./types";
import { generateKeyPair, getSharedSecret } from "./x25519";

function skipKey(dh: string, n: number): string {
  return `${dh}:${n}`;
}

export function createRatchetState(sharedSecret: Uint8Array): RatchetState {
  return {
    dhs: null,
    dhr: null,
    rk: sharedSecret,
    cks: null,
    ckr: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skippedMessageKeys: new Map(),
  };
}

export function initRatchetAsInitiator(
  state: RatchetState,
  remoteRatchetPublicKey: Uint8Array,
): RatchetState {
  const dhs = generateKeyPair();
  const dhOutput = getSharedSecret(dhs.privateKey, remoteRatchetPublicKey);
  const [rk, cks] = kdfRk(state.rk, dhOutput);
  return {
    ...state,
    dhs,
    dhr: remoteRatchetPublicKey,
    rk,
    cks,
    ckr: null,
    ns: 0,
    nr: 0,
    pn: 0,
  };
}

export function initRatchetAsResponder(
  state: RatchetState,
  remoteRatchetPublicKey: Uint8Array,
): RatchetState {
  return {
    ...state,
    dhr: remoteRatchetPublicKey,
    dhs: null,
    cks: null,
    ckr: null,
    ns: 0,
    nr: 0,
    pn: 0,
  };
}

function dhRatchetStep(state: RatchetState): RatchetState {
  const dhr = state.dhr;
  if (!dhr) throw new Error("DH ratchet requires remote public key");

  if (!state.dhs) {
    const dhs = generateKeyPair();
    const dhOutput = getSharedSecret(dhs.privateKey, dhr);
    const [rk, ckr] = kdfRk(state.rk, dhOutput);
    const newDhs = generateKeyPair();
    const dhOutput2 = getSharedSecret(newDhs.privateKey, dhr);
    const [rk2, cks] = kdfRk(rk, dhOutput2);
    return {
      ...state,
      dhs: newDhs,
      rk: rk2,
      ckr,
      cks,
      ns: 0,
      nr: 0,
      pn: state.ns,
    };
  }

  const dhOutput = getSharedSecret(state.dhs.privateKey, dhr);
  const [rk, ckr] = kdfRk(state.rk, dhOutput);
  const newDhs = generateKeyPair();
  const dhOutput2 = getSharedSecret(newDhs.privateKey, dhr);
  const [rk2, cks] = kdfRk(rk, dhOutput2);
  return {
    ...state,
    dhs: newDhs,
    rk: rk2,
    ckr,
    cks,
    ns: 0,
    nr: 0,
    pn: state.ns,
  };
}

function skipMessageKeys(
  state: RatchetState,
  until: number,
): RatchetState {
  if (!state.ckr) return state;
  if (state.nr + MAX_SKIP < until) {
    throw new Error("Too many skipped messages");
  }
  let current = state;
  while (current.nr < until) {
    const [newCkr, mk] = kdfCk(current.ckr!);
    const key = skipKey(toBase64(current.dhr!), current.nr);
    const skipped = new Map(current.skippedMessageKeys);
    skipped.set(key, mk);
    current = { ...current, ckr: newCkr, nr: current.nr + 1, skippedMessageKeys: skipped };
  }
  return current;
}

export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: string,
): Promise<{ state: RatchetState; envelope: EncryptedEnvelope }> {
  let current = state;

  // @TODO: Continue to read this..
  if (!current.cks) {
    if (!current.dhr) {
      throw new Error("Cannot encrypt without remote ratchet key");
    }
    const newDhs = generateKeyPair();
    const dhOutput = getSharedSecret(newDhs.privateKey, current.dhr);
    const [rk, cks] = kdfRk(current.rk, dhOutput);
    current = {
      ...current,
      dhs: newDhs,
      rk,
      cks,
      ns: 0,
      pn: current.nr,
    };
  }

  if (!current.cks || !current.dhs) {
    throw new Error("Sending chain not initialized");
  }

  const [newCks, messageKey] = kdfCk(current.cks);
  const header: RatchetHeader = {
    dhPublicKey: current.dhs.publicKey,
    previousChainLength: current.pn,
    messageNumber: current.ns,
  };
  const headerBytes = serializeHeader(header);
  const ciphertext = await encryptAead(
    messageKey,
    new TextEncoder().encode(plaintext),
    headerBytes,
  );

  return {
    state: {
      ...current,
      cks: newCks,
      ns: current.ns + 1,
    },
    envelope: {
      header: serializeHeaderBase64(header),
      ciphertext: toBase64(ciphertext),
      messageType: "ratchet",
    },
  };
}

export async function ratchetDecrypt(
  state: RatchetState,
  envelope: EncryptedEnvelope,
): Promise<{ state: RatchetState; plaintext: string }> {
  const header = deserializeHeaderBase64(envelope.header);
  let current = state;

  if (
    current.dhr &&
    !constantTimeEqualHeader(current.dhr, header.dhPublicKey)
  ) {
    current = skipMessageKeys(current, header.previousChainLength);
    current = dhRatchetStep({ ...current, dhr: header.dhPublicKey });
  } else if (!current.dhr) {
    current = { ...current, dhr: header.dhPublicKey };
    if (!current.dhs) {
      const dhs = generateKeyPair();
      const dhOutput = getSharedSecret(dhs.privateKey, header.dhPublicKey);
      const [rk, ckr] = kdfRk(current.rk, dhOutput);
      current = { ...current, dhs, rk, ckr };
    }
  }

  if (!current.ckr && current.dhr) {
    if (!current.dhs) {
      const dhs = generateKeyPair();
      const dhOutput = getSharedSecret(dhs.privateKey, current.dhr);
      const [rk, ckr] = kdfRk(current.rk, dhOutput);
      current = { ...current, dhs, rk, ckr };
    }
  }

  const skipKeyStr = skipKey(toBase64(header.dhPublicKey), header.messageNumber);
  let messageKey: Uint8Array | undefined =
    current.skippedMessageKeys.get(skipKeyStr);

  if (!messageKey) {
    current = skipMessageKeys(current, header.messageNumber);
    const [newCkr, mk] = kdfCk(current.ckr!);
    messageKey = mk;
    current = { ...current, ckr: newCkr, nr: current.nr + 1 };
  } else {
    const skipped = new Map(current.skippedMessageKeys);
    skipped.delete(skipKeyStr);
    current = { ...current, skippedMessageKeys: skipped };
  }

  const headerBytes = serializeHeader(header);
  const plaintext = await decryptAead(
    messageKey,
    fromBase64(envelope.ciphertext),
    headerBytes,
  );

  return {
    state: current,
    plaintext: new TextDecoder().decode(plaintext),
  };
}

function constantTimeEqualHeader(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function serializeRatchetState(state: RatchetState): SerializedRatchetState {
  return {
    dhsPublic: state.dhs ? toBase64(state.dhs.publicKey) : null,
    dhsPrivate: state.dhs ? toBase64(state.dhs.privateKey) : null,
    dhr: state.dhr ? toBase64(state.dhr) : null,
    rk: toBase64(state.rk),
    cks: state.cks ? toBase64(state.cks) : null,
    ckr: state.ckr ? toBase64(state.ckr) : null,
    ns: state.ns,
    nr: state.nr,
    pn: state.pn,
    skippedMessageKeys: Array.from(state.skippedMessageKeys.entries()).map(
      ([k, v]) => [k, toBase64(v)],
    ),
  };
}

export function deserializeRatchetState(
  data: SerializedRatchetState,
): RatchetState {
  const dhs: KeyPair | null =
    data.dhsPublic && data.dhsPrivate
      ? {
          publicKey: fromBase64(data.dhsPublic),
          privateKey: fromBase64(data.dhsPrivate),
        }
      : null;
  return {
    dhs,
    dhr: data.dhr ? fromBase64(data.dhr) : null,
    rk: fromBase64(data.rk),
    cks: data.cks ? fromBase64(data.cks) : null,
    ckr: data.ckr ? fromBase64(data.ckr) : null,
    ns: data.ns,
    nr: data.nr,
    pn: data.pn,
    skippedMessageKeys: new Map(
      data.skippedMessageKeys.map(([k, v]) => [k, fromBase64(v)]),
    ),
  };
}

export async function createInitialMessage(
  sharedSecret: Uint8Array,
  remoteRatchetPublicKey: Uint8Array,
  plaintext: string,
  identityPublicKey: Uint8Array,
  ephemeralKey: KeyPair,
  signedPreKeyId: number,
  oneTimePreKeyId?: number,
): Promise<{ state: RatchetState; envelope: EncryptedEnvelope }> {
  let state = createRatchetState(sharedSecret);
  state = initRatchetAsInitiator(state, remoteRatchetPublicKey);
  const result = await ratchetEncrypt(state, plaintext);
  return {
    state: result.state,
    envelope: {
      ...result.envelope,
      messageType: "x3dh_initial",
      identityKey: toBase64(identityPublicKey),
      ephemeralKey: toBase64(ephemeralKey.publicKey),
      signedPreKeyId,
      oneTimePreKeyId,
    },
  };
}

export async function decryptInitialMessage(
  state: RatchetState,
  envelope: EncryptedEnvelope,
  sharedSecret: Uint8Array,
  signedPreKey: KeyPair,
): Promise<{ state: RatchetState; plaintext: string }> {
  const header = deserializeHeaderBase64(envelope.header);
  const dhOutput = getSharedSecret(signedPreKey.privateKey, header.dhPublicKey);
  const [rk, ckr] = kdfRk(sharedSecret, dhOutput);
  const current: RatchetState = {
    ...state,
    rk,
    ckr,
    dhs: signedPreKey,
    dhr: header.dhPublicKey,
    cks: null,
    ns: 0,
    nr: 0,
    pn: 0,
    skippedMessageKeys: new Map(),
  };
  return ratchetDecrypt(current, envelope);
}
