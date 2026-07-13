import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const bundleValidator = v.object({
  registrationId: v.number(),
  identityPublicKey: v.string(),
  signingPublicKey: v.string(),
  signedPreKeyId: v.number(),
  signedPreKeyPublic: v.string(),
  signedPreKeySignature: v.string(),
  oneTimePreKeyId: v.optional(v.number()),
  oneTimePreKeyPublic: v.optional(v.string()),
});

export const getBundle = query({
  args: { deviceConvexId: v.id("devices") },
  returns: v.union(bundleValidator, v.null()),
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceConvexId);
    if (!device) return null;

    const bundle = await ctx.db
      .query("prekeyBundles")
      .withIndex("by_device", (q) => q.eq("deviceConvexId", args.deviceConvexId))
      .unique();
    if (!bundle) return null;

    const opk = bundle.oneTimePreKeys[0];
    return {
      registrationId: device.registrationId,
      identityPublicKey: device.identityPublicKey,
      signingPublicKey: device.signingPublicKey,
      signedPreKeyId: bundle.signedPreKeyId,
      signedPreKeyPublic: bundle.signedPreKeyPublic,
      signedPreKeySignature: bundle.signedPreKeySignature,
      oneTimePreKeyId: opk?.keyId,
      oneTimePreKeyPublic: opk?.publicKey,
    };
  },
});

export const consumeOneTimePreKey = mutation({
  args: {
    deviceConvexId: v.id("devices"),
    keyId: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bundle = await ctx.db
      .query("prekeyBundles")
      .withIndex("by_device", (q) => q.eq("deviceConvexId", args.deviceConvexId))
      .unique();
    if (!bundle) throw new Error("Bundle not found");

    const remaining = bundle.oneTimePreKeys.filter((k) => k.keyId !== args.keyId);
    await ctx.db.patch(bundle._id, {
      oneTimePreKeys: remaining,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const uploadBundle = mutation({
  args: {
    deviceConvexId: v.id("devices"),
    deviceId: v.string(),
    signedPreKeyId: v.number(),
    signedPreKeyPublic: v.string(),
    signedPreKeySignature: v.string(),
    oneTimePreKeys: v.array(
      v.object({
        keyId: v.number(),
        publicKey: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceConvexId);
    if (!device || device.deviceId !== args.deviceId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("prekeyBundles")
      .withIndex("by_device", (q) => q.eq("deviceConvexId", args.deviceConvexId))
      .unique();

    const data = {
      signedPreKeyId: args.signedPreKeyId,
      signedPreKeyPublic: args.signedPreKeyPublic,
      signedPreKeySignature: args.signedPreKeySignature,
      oneTimePreKeys: args.oneTimePreKeys,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("prekeyBundles", {
        deviceConvexId: args.deviceConvexId,
        ...data,
      });
    }
    return null;
  },
});

export const replenishOneTimePreKeys = mutation({
  args: {
    deviceConvexId: v.id("devices"),
    deviceId: v.string(),
    oneTimePreKeys: v.array(
      v.object({
        keyId: v.number(),
        publicKey: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceConvexId);
    if (!device || device.deviceId !== args.deviceId) {
      throw new Error("Unauthorized");
    }

    const bundle = await ctx.db
      .query("prekeyBundles")
      .withIndex("by_device", (q) => q.eq("deviceConvexId", args.deviceConvexId))
      .unique();
    if (!bundle) throw new Error("Bundle not found");

    await ctx.db.patch(bundle._id, {
      oneTimePreKeys: [...bundle.oneTimePreKeys, ...args.oneTimePreKeys],
      updatedAt: Date.now(),
    });
    return null;
  },
});
