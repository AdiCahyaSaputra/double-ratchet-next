import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const PROVISIONING_TTL_MS = 10 * 60 * 1000;

export const createRequest = mutation({
  args: {
    provisioningId: v.string(),
    ephemeralPublicKey: v.string(),
    deviceName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("provisioningRequests", {
      provisioningId: args.provisioningId,
      ephemeralPublicKey: args.ephemeralPublicKey,
      deviceName: args.deviceName,
      status: "pending",
      expiresAt: Date.now() + PROVISIONING_TTL_MS,
    });
    return null;
  },
});

export const getRequest = query({
  args: { provisioningId: v.string() },
  returns: v.union(
    v.object({
      provisioningId: v.string(),
      ephemeralPublicKey: v.string(),
      deviceName: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("expired"),
      ),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("provisioningRequests")
      .withIndex("by_provisioning_id", (q) =>
        q.eq("provisioningId", args.provisioningId),
      )
      .unique();
    if (!request) return null;
    return {
      provisioningId: request.provisioningId,
      ephemeralPublicKey: request.ephemeralPublicKey,
      deviceName: request.deviceName,
      status: request.status,
      expiresAt: request.expiresAt,
    };
  },
});

export const sendProvisioningMessage = mutation({
  args: {
    provisioningId: v.string(),
    primaryEphemeralPublicKey: v.string(),
    encryptedPayload: v.string(),
    primaryDeviceId: v.string(),
    primaryDeviceConvexId: v.id("devices"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const primary = await ctx.db.get("devices", args.primaryDeviceConvexId);
    if (!primary || primary.deviceId !== args.primaryDeviceId) {
      throw new Error("Unauthorized");
    }
    if (!primary.isPrimary) {
      throw new Error("Only primary device can provision");
    }

    await ctx.db.insert("provisioningMessages", {
      provisioningId: args.provisioningId,
      primaryEphemeralPublicKey: args.primaryEphemeralPublicKey,
      encryptedPayload: args.encryptedPayload,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const getProvisioningMessage = query({
  args: { provisioningId: v.string() },
  returns: v.union(
    v.object({
      primaryEphemeralPublicKey: v.string(),
      encryptedPayload: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const msg = await ctx.db
      .query("provisioningMessages")
      .withIndex("by_provisioning_id", (q) =>
        q.eq("provisioningId", args.provisioningId),
      )
      .unique();
    if (!msg) return null;
    return {
      primaryEphemeralPublicKey: msg.primaryEphemeralPublicKey,
      encryptedPayload: msg.encryptedPayload,
    };
  },
});

export const completeProvisioning = mutation({
  args: { provisioningId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("provisioningRequests")
      .withIndex("by_provisioning_id", (q) =>
        q.eq("provisioningId", args.provisioningId),
      )
      .unique();
    if (request) {
      await ctx.db.patch(request._id, { status: "completed" });
    }
    return null;
  },
});
