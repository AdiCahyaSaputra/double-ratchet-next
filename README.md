# Double Ratchet Chat (Next.js + Convex)

End-to-end encrypted messaging built from scratch using the [Signal Double Ratchet](https://signal.org/docs/specifications/doubleratchet/) algorithm, [X3DH](https://signal.org/docs/specifications/x3dh/) key agreement, and a simplified [Sesame](https://signal.org/docs/specifications/sesame/) session manager for multi-device support.

## Features

- **Custom crypto** — X25519, HKDF-SHA256, AES-256-GCM (no libsignal dependency)
- **Double Ratchet** — forward secrecy via symmetric + DH ratchets
- **X3DH** — asynchronous session establishment with prekey bundles
- **Multi-device** — per-device sessions, message fan-out to all recipient devices
- **Device linking** — QR provisioning with encrypted sync channel and optional history archive
- **Cross-device sync** — linked devices share plaintext copies and session state via an encrypted sync channel (not by reusing another device's Convex ciphertext)
- **Convex backend** — real-time message relay, sync event queue, and public key directory (stores ciphertext only)

## Architecture

```
┌─────────────┐     encrypted envelopes      ┌─────────────┐
│   Client    │ ◄──────────────────────────► │   Convex    │
│  (Next.js)  │     prekey bundles (public)  │   Backend   │
│             │     device sync events       │             │
│ IndexedDB:  │                              │  ciphertext │
│ - identity  │                              │  + pubkeys  │
│ - sessions  │                              │  + sync evt │
│ - ratchet   │                              └─────────────┘
│ - history   │
└─────────────┘
```

<img width="5692" height="5224" alt="image" src="https://github.com/user-attachments/assets/a0fe5f41-a48c-4762-9dae-00bd7443f6d4" />

**Security boundary:** The server never sees private keys, ratchet state, or plaintext chat content. It relays encrypted message envelopes, distributes public prekey material, and queues encrypted sync payloads between a user's own devices.

### How multi-device sync works

Each device has its own identity keys and Double Ratchet sessions. Messages in Convex are addressed to a specific `recipientDeviceId`, so a linked device **cannot** decrypt envelopes meant for the primary device (or vice versa).

Instead, devices on the same account share a **sync channel key** established during QR linking:

1. **Initial link** — The primary scans the new device's QR code. An ephemeral ECDH exchange derives the sync channel key. The primary optionally uploads an encrypted archive (sessions + local message history + decryptable Convex history).
2. **Ongoing sync** — When any linked device sends or receives a message, it pushes a `message_copy` event (AES-GCM encrypted with the sync channel key) to sibling devices via `deviceSyncEvents`.
3. **Key recovery** — The sync channel key is stored locally on each device and mirrored on the account record in Convex so a device that missed linking (e.g. the primary before a fix) can fetch it on next app load.

```
Primary ──encrypt(syncKey)──► Convex sync queue ──► Linked device
   ▲                                                    │
   └──────────── same flow in reverse ─────────────────┘
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm

### Install

```bash
pnpm install
```

### Start Convex (terminal 1)

```bash
npx convex dev
```

Keep this running while developing. Convex function and schema changes are **not** picked up by `pnpm dev` alone — if you change files under `convex/`, this process must be running (or run `npx convex dev --once` to push once).

### Start Next.js (terminal 2)

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
pnpm test
```

## Usage

1. **Register** — Create an account at `/register` with username and password; keys are generated locally in IndexedDB. This browser becomes the **primary** device.
2. **Sign in** — Use `/login` with your credentials. If this browser has no local keys yet, you will be sent to `/link` to provision the device.
3. **Chat** — Browse users at `/users` and send encrypted messages. Outgoing messages are fanned out to all of the recipient's devices. Incoming messages are decrypted locally and synced to sibling devices.
4. **Link a new device**
   - On the **new device**: sign in → open `/link` → enter a device name → generate QR code
   - On the **primary device**: open `/settings/devices` → scan the QR (or paste the QR JSON manually)
   - Wait for sync to complete on the new device before navigating away
5. **Manage devices** — View and unlink devices from `/settings/devices` (primary only)

### Multi-device tips

- Both primary and linked devices can send messages; all siblings receive copies via the sync channel.
- If messages don't appear on a device, refresh both devices. The app bootstraps the sync channel key on load.
- Opening a chat on one device backfills that conversation's local history to siblings.
- Messages stored in Convex for device A are not readable on device B — look for synced copies in local message history, not raw Convex rows.

## Project structure

```
src/lib/crypto/       # X25519, HKDF, KDF chains, X3DH, Double Ratchet
src/lib/sesame/       # Per-device session manager + fan-out
src/lib/device-sync/  # QR provisioning, sync channel, archive, key bootstrap
src/lib/storage/      # IndexedDB identity, account, session, message history
src/hooks/            # useEncryptedChat, useDeviceSync, useDeviceLinking
convex/               # Accounts, devices, messages, provisioning, deviceSync
```

## Gap between Real Spec and Example Project

This teaching project diverges from a production-grade Signal-style stack in several ways (trust records, prekey lifecycle, session recovery, sync channel design, and more). See the full gap map: [Gap between Real Spec and Example Project (#2)](https://github.com/AdiCahyaSaputra/double-ratchet-next/issues/2).

## Threat model

| Threat | Mitigation |
|--------|------------|
| Server reads messages | E2E encryption; server stores ciphertext only |
| Stolen old message keys | Forward secrecy via ratchet |
| Stolen current device keys | Future secrecy via DH ratchet steps |
| Multi-device delivery | Separate session per device; fan-out encrypt to peers |
| Device linking interception | Ephemeral ECDH + short-lived provisioning TTL |
| Sync channel exposure | Sync payloads encrypted with per-link AES-GCM key; key derived from ephemeral ECDH |

**Not in scope (v1):** Header encryption, post-quantum ratchet, group messaging, password reset, production session auth.

## Auth note

Accounts use username + password (PBKDF2-SHA-256 hashed on the server). E2E private keys remain local in IndexedDB — password login verifies account ownership but does not restore keys on a new browser. New devices must complete QR provisioning from a primary device. Camera QR scanning is supported on the primary device at `/settings/devices` (requires HTTPS or localhost). Device mutations use device-ID ownership checks for the demo.

The sync channel key is stored on the Convex account record to let all linked devices recover it. This is a convenience trade-off for the demo; production deployments should derive or escrow this key through a stronger mechanism.

## License

MIT
