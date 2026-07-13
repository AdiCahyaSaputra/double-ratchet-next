import { describe, expect, it } from "vitest";
import {
  createRatchetState,
  ratchetEncrypt,
  ratchetDecrypt,
  createInitialMessage,
  decryptInitialMessage,
} from "@/lib/crypto/double-ratchet";
import {
  generateIdentityKeys,
  generateSignedPreKey,
  generateOneTimePreKeys,
  performX3DHInitiator,
  performX3DHResponder,
  createPreKeyBundle,
} from "@/lib/crypto/x3dh";
import { generateKeyPair } from "@/lib/crypto/x25519";

async function setupSession() {
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

  const x3dhAlice = performX3DHInitiator({
    identityKey: aliceIdentity.identityKey,
    ephemeralKey,
    remoteBundle: bundle,
  });

  const sharedBob = performX3DHResponder({
    identityKey: bobIdentity.identityKey,
    signedPreKey: bobSignedPreKey.keyPair,
    signedPreKeyId: bobSignedPreKey.keyId,
    oneTimePreKey: bobOpks[0]!.keyPair,
    oneTimePreKeyId: bobOpks[0]!.keyId,
    remoteIdentityKey: aliceIdentity.identityKey.publicKey,
    remoteEphemeralKey: ephemeralKey.publicKey,
  });

  const { state: aliceState, envelope: firstEnvelope } =
    await createInitialMessage(
      x3dhAlice.sharedSecret,
      bundle.signedPreKey,
      "Hello Bob",
      aliceIdentity.identityKey.publicKey,
      ephemeralKey,
      bundle.signedPreKeyId,
      bundle.oneTimePreKeyId,
    );

  let bobState = createRatchetState(sharedBob);
  const { state: bobStateAfter, plaintext } = await decryptInitialMessage(
    bobState,
    firstEnvelope,
    sharedBob,
    bobSignedPreKey.keyPair,
  );

  return {
    aliceState,
    bobState: bobStateAfter,
    firstPlaintext: plaintext,
  };
}

describe("Double Ratchet", () => {
  it("decrypts initial X3DH message", async () => {
    const { firstPlaintext } = await setupSession();
    expect(firstPlaintext).toBe("Hello Bob");
  });

  it("round-trips Alice -> Bob -> Alice", async () => {
    const { aliceState, bobState } = await setupSession();

    const bobReply = await ratchetEncrypt(bobState, "Hello Alice");
    const aliceDecrypt = await ratchetDecrypt(
      aliceState,
      bobReply.envelope,
    );
    expect(aliceDecrypt.plaintext).toBe("Hello Alice");

    const aliceReply = await ratchetEncrypt(
      aliceDecrypt.state,
      "Hi again Bob",
    );
    const bobDecrypt = await ratchetDecrypt(
      bobReply.state,
      aliceReply.envelope,
    );
    expect(bobDecrypt.plaintext).toBe("Hi again Bob");
  });
});
