import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

import { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function verifyDeviceOwnership(
  ctx: MutationCtx,
  deviceConvexId: Id<"devices">,
  deviceId: string,
) {
  const device = await ctx.db.get("devices", deviceConvexId);
  if (!device || device.deviceId !== deviceId) {
    throw new Error("Unauthorized device");
  }
  return device;
}

const deviceValidator = v.object({
  _id: v.id("devices"),
  _creationTime: v.number(),
  accountId: v.id("accounts"),
  deviceId: v.string(),
  deviceName: v.string(),
  isPrimary: v.boolean(),
  identityPublicKey: v.string(),
  signingPublicKey: v.string(),
  registrationId: v.number(),
  lastSeenAt: v.number(),
  createdAt: v.number(),
});

export const listDevicesForAccount = query({
  args: { accountId: v.id("accounts") },
  returns: v.array(deviceValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
  },
});

export const listDevicesByUsername = query({
  args: { username: v.string() },
  returns: v.array(deviceValidator),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!account) return [];
    return await ctx.db
      .query("devices")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .collect();
  },
});

export const getDeviceByClientId = query({
  args: { deviceId: v.string() },
  returns: v.union(deviceValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .unique();
  },
});

export const linkDevice = mutation({
  args: {
    provisioningId: v.string(),
    deviceId: v.string(),
    identityPublicKey: v.string(),
    signingPublicKey: v.string(),
    registrationId: v.number(),
    signedPreKeyId: v.number(),
    signedPreKeyPublic: v.string(),
    signedPreKeySignature: v.string(),
    oneTimePreKeys: v.array(
      v.object({
        keyId: v.number(),
        publicKey: v.string(),
      }),
    ),
    accountId: v.id("accounts"),
    deviceName: v.string(),
  },
  returns: v.id("devices"),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("provisioningRequests")
      .withIndex("by_provisioning_id", (q) =>
        q.eq("provisioningId", args.provisioningId),
      )
      .unique();
    if (!request || request.status !== "pending") {
      throw new Error("Invalid provisioning request");
    }
    if (request.expiresAt < Date.now()) {
      throw new Error("Provisioning request expired");
    }

    const now = Date.now();
    const deviceConvexId = await ctx.db.insert("devices", {
      accountId: args.accountId,
      deviceId: args.deviceId,
      deviceName: args.deviceName,
      isPrimary: false,
      identityPublicKey: args.identityPublicKey,
      signingPublicKey: args.signingPublicKey,
      registrationId: args.registrationId,
      lastSeenAt: now,
      createdAt: now,
    });

    await ctx.db.insert("prekeyBundles", {
      deviceConvexId,
      signedPreKeyId: args.signedPreKeyId,
      signedPreKeyPublic: args.signedPreKeyPublic,
      signedPreKeySignature: args.signedPreKeySignature,
      oneTimePreKeys: args.oneTimePreKeys,
      updatedAt: now,
    });

    await ctx.db.patch(request._id, { status: "completed" });
    return deviceConvexId;
  },
});

export const unlinkDevice = mutation({
  args: {
    primaryDeviceId: v.string(),
    primaryDeviceConvexId: v.id("devices"),
    targetDeviceConvexId: v.id("devices"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const primary = await verifyDeviceOwnership(
      ctx,
      args.primaryDeviceConvexId,
      args.primaryDeviceId,
    );
    if (!primary) throw new Error("Primary device not found");

    const target = await ctx.db.get("devices", args.targetDeviceConvexId);
    if (!target) throw new Error("Device not found");
    if (target.isPrimary) throw new Error("Cannot unlink primary device");

    const bundle = await ctx.db
      .query("prekeyBundles")
      .withIndex("by_device", (q) =>
        q.eq("deviceConvexId", args.targetDeviceConvexId),
      )
      .unique();
    if (bundle) await ctx.db.delete(bundle._id);
    await ctx.db.delete(args.targetDeviceConvexId);
    return null;
  },
});

export const updateLastSeen = mutation({
  args: {
    deviceConvexId: v.id("devices"),
    deviceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await verifyDeviceOwnership(ctx, args.deviceConvexId, args.deviceId);
    await ctx.db.patch(args.deviceConvexId, { lastSeenAt: Date.now() });
    return null;
  },
});
