import { describe, expect, it } from "vitest";
import { kdfCk, kdfRk } from "@/lib/crypto/kdf";
import { randomBytes } from "@/lib/crypto/bytes";
import { KEY_LENGTH } from "@/lib/crypto/types";

describe("KDF chains", () => {
  it("KDF_RK produces 32-byte root and chain keys", () => {
    const rk = randomBytes(KEY_LENGTH);
    const dh = randomBytes(KEY_LENGTH);
    const [newRk, ck] = kdfRk(rk, dh);
    expect(newRk.length).toBe(32);
    expect(ck.length).toBe(32);
  });

  it("KDF_CK produces 32-byte chain and message keys", () => {
    const ck = randomBytes(KEY_LENGTH);
    const [newCk, mk] = kdfCk(ck);
    expect(newCk.length).toBe(32);
    expect(mk.length).toBe(32);
  });

  it("KDF_RK is deterministic", () => {
    const rk = randomBytes(KEY_LENGTH);
    const dh = randomBytes(KEY_LENGTH);
    const a = kdfRk(rk, dh);
    const b = kdfRk(rk, dh);
    expect(a[0]).toEqual(b[0]);
    expect(a[1]).toEqual(b[1]);
  });
});
