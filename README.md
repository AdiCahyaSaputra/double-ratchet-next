# Double Ratchet Chat (Next.js + Convex)

End-to-end encrypted messaging built from scratch using the [Signal Double Ratchet](https://signal.org/docs/specifications/doubleratchet/) algorithm, [X3DH](https://signal.org/docs/specifications/x3dh/) key agreement, and a simplified [Sesame](https://signal.org/docs/specifications/sesame/) session manager for multi-device support.

## Features

- **Custom crypto** — X25519, HKDF-SHA256, AES-256-GCM (no libsignal dependency)
- **Double Ratchet** — forward secrecy via symmetric + DH ratchets
- **X3DH** — asynchronous session establishment with prekey bundles
- **Multi-device** — per-device sessions, message fan-out to all recipient devices
- **Device linking** — QR provisioning with encrypted sync channel and optional history archive
- **Convex backend** — real-time message relay and public key directory (stores ciphertext only)

## Architecture

```
┌─────────────┐     encrypted envelopes      ┌─────────────┐
│   Client    │ ◄──────────────────────────► │   Convex    │
│  (Next.js)  │     prekey bundles (public)  │   Backend   │
│             │                              │             │
│ IndexedDB:  │                              │  ciphertext │
│ - identity  │                              │  + pubkeys  │
│ - sessions  │                              └─────────────┘
│ - ratchet   │
└─────────────┘
```

**Security boundary:** The server never sees private keys, ratchet state, or plaintext. It only relays encrypted blobs and distributes public prekey material.

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Start Convex (terminal 1)

```bash
npx convex dev
```

### Start Next.js (terminal 2)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
npm test
```

## Usage

1. **Register** — Create an account at `/register` with username and password; keys are generated locally in IndexedDB
2. **Sign in** — Use `/login` with your credentials. If this browser has no local keys yet, you will be sent to `/link` to provision the device
3. **Chat** — Browse users and send encrypted messages (fan-out to all peer devices)
4. **Link device** — On a new device, sign in then open `/link` to show a QR code; on your primary device, scan it at `/settings/devices` (paste fallback available)
5. **Manage devices** — View and unlink devices from settings

## Project structure

```
src/lib/crypto/       # X25519, HKDF, KDF chains, X3DH, Double Ratchet
src/lib/sesame/       # Per-device session manager + fan-out
src/lib/device-sync/  # QR provisioning, sync channel, archive
src/lib/storage/      # IndexedDB identity, account, session stores
convex/               # Accounts, devices, messages, provisioning, sync
```

## Threat model

| Threat | Mitigation |
|--------|------------|
| Server reads messages | E2E encryption; server stores ciphertext only |
| Stolen old message keys | Forward secrecy via ratchet |
| Stolen current device keys | Future secrecy via DH ratchet steps |
| Multi-device delivery | Separate session per device; fan-out encrypt |
| Device linking interception | Ephemeral ECDH + short-lived provisioning TTL |

**Not in scope (v1):** Header encryption, post-quantum ratchet, group messaging, password reset, production session auth.

## Auth note

Accounts use username + password (PBKDF2-SHA-256 hashed on the server). E2E private keys remain local in IndexedDB — password login verifies account ownership but does not restore keys on a new browser. New devices must complete QR provisioning from a primary device. Camera QR scanning is supported on the primary device at `/settings/devices` (requires HTTPS or localhost). Device mutations still use device-ID ownership checks for the demo.

## License

MIT
