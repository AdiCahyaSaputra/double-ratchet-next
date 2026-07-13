import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  accounts: defineTable({
    username: v.string(),
    passwordSalt: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  devices: defineTable({
    accountId: v.id("accounts"),
    deviceId: v.string(),
    deviceName: v.string(),
    isPrimary: v.boolean(),
    identityPublicKey: v.string(),
    signingPublicKey: v.string(),
    registrationId: v.number(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_device", ["deviceId"]),

  prekeyBundles: defineTable({
    deviceConvexId: v.id("devices"),
    signedPreKeyId: v.number(),
    signedPreKeyPublic: v.string(),
    signedPreKeySignature: v.string(),
    oneTimePreKeys: v.array(
      v.object({
        keyId: v.number(),
        publicKey: v.string(),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_device", ["deviceConvexId"]),

  messages: defineTable({
    senderDeviceId: v.id("devices"),
    recipientDeviceId: v.id("devices"),
    envelope: v.string(),
    createdAt: v.number(),
  })
    .index("by_recipient_device", ["recipientDeviceId", "createdAt"])
    .index("by_conversation", [
      "senderDeviceId",
      "recipientDeviceId",
      "createdAt",
    ]),

  provisioningRequests: defineTable({
    provisioningId: v.string(),
    ephemeralPublicKey: v.string(),
    deviceName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("expired"),
    ),
    expiresAt: v.number(),
  }).index("by_provisioning_id", ["provisioningId"]),

  provisioningMessages: defineTable({
    provisioningId: v.string(),
    primaryEphemeralPublicKey: v.string(),
    encryptedPayload: v.string(),
    createdAt: v.number(),
  }).index("by_provisioning_id", ["provisioningId"]),

  deviceSyncEvents: defineTable({
    targetDeviceId: v.id("devices"),
    sourceDeviceId: v.id("devices"),
    encryptedPayload: v.string(),
    createdAt: v.number(),
  }).index("by_target_device", ["targetDeviceId", "createdAt"]),

  syncArchives: defineTable({
    provisioningId: v.string(),
    encryptedArchive: v.string(),
    expiresAt: v.number(),
  }).index("by_provisioning_id", ["provisioningId"]),
});
