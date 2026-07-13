import { describe, expect, it } from "vitest";
import {
  generateIdentityKeys,
  generateSignedPreKey,
  generateOneTimePreKeys,
  performX3DHInitiator,
  performX3DHResponder,
  createPreKeyBundle,
} from "@/lib/crypto/x3dh";
import { generateKeyPair } from "@/lib/crypto/x25519";

describe("X3DH", () => {
  it("initiator and responder derive the same shared secret", () => {
    const aliceIdentity = generateIdentityKeys();
    const bobIdentity = generateIdentityKeys();
    const bobSignedPreKey = generateSignedPreKey(
      1,
      bobIdentity.signingKey.privateKey,
    );
    const bobOpks = generateOneTimePreKeys(1, 1);

    const bobStore = {
      identity: bobIdentity,
      signedPreKey: bobSignedPreKey,
      oneTimePreKeys: bobOpks,
    };

    const bundle = createPreKeyBundle(bobStore, true);
    const ephemeralKey = generateKeyPair();

    const initiator = performX3DHInitiator({
      identityKey: aliceIdentity.identityKey,
      ephemeralKey,
      remoteBundle: bundle,
    });

    const responder = performX3DHResponder({
      identityKey: bobIdentity.identityKey,
      signedPreKey: bobSignedPreKey.keyPair,
      signedPreKeyId: bobSignedPreKey.keyId,
      oneTimePreKey: bobOpks[0]!.keyPair,
      oneTimePreKeyId: bobOpks[0]!.keyId,
      remoteIdentityKey: aliceIdentity.identityKey.publicKey,
      remoteEphemeralKey: ephemeralKey.publicKey,
    });

    expect(initiator.sharedSecret).toEqual(responder);
  });
});
