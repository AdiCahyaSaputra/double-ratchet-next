# Chat ID: 

# Pre-Key Bundling  
1. Which values must Alice include in the initial envelope so Bob can reproduce the X3DH calculation, and which sensitive value must never be included?

Alice send :
- Identity Key (Public)
- Ephermal Key (Public)
- Bob's signed-prekey ID
- Bob's one-time-prekey ID

2. Why does the same plaintext sent to two Bob devices produce two encrypted envelopes?

Because each device generate different pre-key

3. Why do Bob should generate bunch of pre-key when registering ? what is the different between signed pre-key and signature key ? Why they generate list of One Time pre-key ?

Bob uploads prekeys so Alice can start an encrypted session while Bob is offline.

**Signed prekey**: a medium-lived X25519 key pair. Bob publishes its public key and rotates it periodically. It lets many new sessions begin without Bob being online.

**Signature key**: the Ed25519 key pair used to sign the **signed prekey’s** public key. Its job is authentication: Alice verifies the signature so a malicious server cannot replace Bob’s signed prekey with an attacker’s key.

**One-time prekeys**: many single-use X25519 key pairs. The server gives one to Alice with the bundle, then deletes it. Once Bob processes the initial message, he deletes its private half too. Each first-contact session needs a different one

# Session Bootstrapping
1. Suppose Alice has `CK₅` and sends one message. What is stored afterward, and what must be discarded?

CKS6 and MK5 are created and persist by kdf and MK4 must be discarded


2. Does message #2 create a new X3DH secret? Explain in one sentence.

No, it only happen to initiate session. It produce initial shared secret and Double Ratchet initialize CKS1 or CKR1 and MK0 using it

# Future Secrecy
1. An attacker obtains `CK₃` today. Can they decrypt messages encrypted with `MK₀`, `MK₁`, and `MK₂`? Why?

No, because they still need earlier chain key like CK2 or CK1 

2. Why is a fresh DH step needed if a symmetric chain already gives forward secrecy?

An attacker can encrypt or decrypt incoming or future messages. The "fresh DH ratchet turn" stops them from doing that because it mixes in a new private DH key they did not steal.

3. In your own words: which event makes Alice call `dhRatchetStep()` in this implementation?

I think it's whenever Bob change their DH public key, send it on message header, and Alice need to derive the same CK and MK to decrypt Bob message

4. When is the "fresh DH ratchet" turn ?

From my understanding:
- Alice send 1 message (using Bob's first DH public key)
- Bob immediately replied the message (Bob generate new DH public key)
- Alice immediately replied with one message (doing dhRatchetStep to match current DHr to Bob DHs, generate new DHs for incoming send message)
- Bob immediately replied again with 4 message (doing dhRatchetStep because Alice's DHs changes, generate new DHs, use that same DHs for those 4 messages)
- Alice replied again with one message (doing dhRatchetStep..) and advances `ckr` three times with the same DHr

# Multi Device Delivery
