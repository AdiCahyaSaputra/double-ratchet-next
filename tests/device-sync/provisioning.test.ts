import { describe, expect, it } from "vitest";
import {
  deriveSyncChannelKey,
  createProvisioningRequest,
} from "@/lib/device-sync/provisioning";
import { fromBase64 } from "@/lib/crypto/bytes";
import { generateKeyPair } from "@/lib/crypto/x25519";

describe("Device sync", () => {
  it("provisioning handshake derives same sync key on both sides", () => {
    const linked = createProvisioningRequest("Test Device");
    const primaryEphemeral = generateKeyPair();

    const linkedKey = deriveSyncChannelKey(
      linked.ephemeralKey.privateKey,
      primaryEphemeral.publicKey,
    );

    const primaryKey = deriveSyncChannelKey(
      primaryEphemeral.privateKey,
      fromBase64(linked.payload.ephemeralPublicKey),
    );

    expect(linkedKey).toEqual(primaryKey);
  });
});
