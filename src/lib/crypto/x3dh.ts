import { ed25519 } from "@noble/curves/ed25519.js";
import { concat, toBase64 } from "./bytes";
import { hkdfSha256DefaultSalt } from "./hkdf";
import { generateKeyPair, getSharedSecret } from "./x25519";
import type { KeyPair, PreKeyBundle } from "./types";

export interface IdentityKeys {
  identityKey: KeyPair;
  signingKey: KeyPair;
  registrationId: number;
}

export interface OneTimePreKey {
  keyId: number;
  keyPair: KeyPair;
}

export interface SignedPreKey {
  keyId: number;
  keyPair: KeyPair;
  signature: Uint8Array;
}

export interface LocalPreKeyStore {
  identity: IdentityKeys;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
}

export interface X3DHInitiatorParams {
  identityKey: KeyPair;
  ephemeralKey: KeyPair;
  remoteBundle: PreKeyBundle;
}

export interface X3DHInitiatorResult {
  sharedSecret: Uint8Array;
  ephemeralKey: KeyPair;
  usedOneTimePreKeyId?: number;
}

export interface X3DHResponderParams {
  identityKey: KeyPair;
  signedPreKey: KeyPair;
  signedPreKeyId: number;
  oneTimePreKey?: KeyPair;
  oneTimePreKeyId?: number;
  remoteIdentityKey: Uint8Array;
  remoteEphemeralKey: Uint8Array;
}

function signPreKey(
  signingPrivateKey: Uint8Array,
  preKeyPublic: Uint8Array,
): Uint8Array {
  return ed25519.sign(preKeyPublic, signingPrivateKey);
}

export function verifySignedPreKey(
  identityPublicKey: Uint8Array,
  signedPreKeyPublic: Uint8Array,
  signature: Uint8Array,
  signingPublicKey?: Uint8Array,
): boolean {
  const pubKey = signingPublicKey ?? identityPublicKey;
  try {
    return ed25519.verify(signature, signedPreKeyPublic, pubKey);
  } catch {
    return false;
  }
}

export function generateIdentityKeys(): IdentityKeys {
  const identityKey = generateKeyPair();
  const signingPrivateKey = ed25519.utils.randomSecretKey();
  const signingPublicKey = ed25519.getPublicKey(signingPrivateKey);
  const registrationId = Math.floor(Math.random() * 0x3fff) + 1;
  return {
    identityKey,
    signingKey: { publicKey: signingPublicKey, privateKey: signingPrivateKey },
    registrationId,
  };
}

export function generateSignedPreKey(
  keyId: number,
  signingPrivateKey: Uint8Array,
): SignedPreKey {
  const keyPair = generateKeyPair();
  const signature = signPreKey(signingPrivateKey, keyPair.publicKey);
  return { keyId, keyPair, signature };
}

export function generateOneTimePreKeys(
  startId: number,
  count: number,
): OneTimePreKey[] {
  return Array.from({ length: count }, (_, i) => ({
    keyId: startId + i,
    keyPair: generateKeyPair(),
  }));
}

export function createPreKeyBundle(
  store: LocalPreKeyStore,
  includeOneTimePreKey = true,
): PreKeyBundle {
  const bundle: PreKeyBundle = {
    registrationId: store.identity.registrationId,
    identityKey: store.identity.identityKey.publicKey,
    signedPreKeyId: store.signedPreKey.keyId,
    signedPreKey: store.signedPreKey.keyPair.publicKey,
    signedPreKeySignature: store.signedPreKey.signature,
  };
  if (includeOneTimePreKey && store.oneTimePreKeys.length > 0) {
    const opk = store.oneTimePreKeys[0]!;
    bundle.oneTimePreKeyId = opk.keyId;
    bundle.oneTimePreKey = opk.keyPair.publicKey;
  }
  return bundle;
}

export function performX3DHInitiator(
  params: X3DHInitiatorParams,
): X3DHInitiatorResult {
  const { identityKey, ephemeralKey, remoteBundle } = params;

  const dh1 = getSharedSecret(
    identityKey.privateKey,
    remoteBundle.signedPreKey,
  );
  const dh2 = getSharedSecret(
    ephemeralKey.privateKey,
    remoteBundle.identityKey,
  );
  const dh3 = getSharedSecret(
    ephemeralKey.privateKey,
    remoteBundle.signedPreKey,
  );

  const dhInputs = [dh1, dh2, dh3];

  let usedOneTimePreKeyId: number | undefined;
  if (remoteBundle.oneTimePreKey) {
    const dh4 = getSharedSecret(
      ephemeralKey.privateKey,
      remoteBundle.oneTimePreKey,
    );
    dhInputs.push(dh4);
    usedOneTimePreKeyId = remoteBundle.oneTimePreKeyId;
  }

  const sharedSecret = hkdfSha256DefaultSalt(concat(...dhInputs), "X3DH", 32);
  return { sharedSecret, ephemeralKey, usedOneTimePreKeyId };
}

export function performX3DHResponder(
  params: X3DHResponderParams,
): Uint8Array {
  const {
    identityKey,
    signedPreKey,
    oneTimePreKey,
    remoteIdentityKey,
    remoteEphemeralKey,
  } = params;

  const dh1 = getSharedSecret(signedPreKey.privateKey, remoteIdentityKey);
  const dh2 = getSharedSecret(identityKey.privateKey, remoteEphemeralKey);
  const dh3 = getSharedSecret(signedPreKey.privateKey, remoteEphemeralKey);

  const dhInputs = [dh1, dh2, dh3];

  if (oneTimePreKey) {
    const dh4 = getSharedSecret(oneTimePreKey.privateKey, remoteEphemeralKey);
    dhInputs.push(dh4);
  }

  return hkdfSha256DefaultSalt(concat(...dhInputs), "X3DH", 32);
}

export function bundleToWireFormat(bundle: PreKeyBundle): {
  registrationId: number;
  identityPublicKey: string;
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
} {
  const oneTimePreKeys =
    bundle.oneTimePreKey && bundle.oneTimePreKeyId !== undefined
      ? [
          {
            keyId: bundle.oneTimePreKeyId,
            publicKey: toBase64(bundle.oneTimePreKey),
          },
        ]
      : [];
  return {
    registrationId: bundle.registrationId,
    identityPublicKey: toBase64(bundle.identityKey),
    signedPreKeyId: bundle.signedPreKeyId,
    signedPreKeyPublic: toBase64(bundle.signedPreKey),
    signedPreKeySignature: toBase64(bundle.signedPreKeySignature),
    oneTimePreKeys,
  };
}

export function generateLocalPreKeyStore(): LocalPreKeyStore {
  const identity = generateIdentityKeys();
  const signedPreKey = generateSignedPreKey(1, identity.signingKey.privateKey);
  const oneTimePreKeys = generateOneTimePreKeys(1, 20);
  return { identity, signedPreKey, oneTimePreKeys };
}
