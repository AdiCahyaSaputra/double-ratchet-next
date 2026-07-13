import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query } from "./_generated/server";

export const pushSyncEvent = mutation({
  args: {
    sourceDeviceId: v.string(),
    sourceDeviceConvexId: v.id("devices"),
    targetDeviceConvexId: v.id("devices"),
    encryptedPayload: v.string(),
  },
  returns: v.id("deviceSyncEvents"),
  handler: async (ctx, args) => {
    const source = await ctx.db.get("devices", args.sourceDeviceConvexId);
    if (!source || source.deviceId !== args.sourceDeviceId) {
      throw new Error("Unauthorized");
    }

    const target = await ctx.db.get("devices", args.targetDeviceConvexId);
    if (!target || target.accountId !== source.accountId) {
      throw new Error("Unauthorized target device");
    }
    if (target._id === source._id) {
      throw new Error("Cannot sync to self");
    }

    return await ctx.db.insert("deviceSyncEvents", {
      targetDeviceId: args.targetDeviceConvexId,
      sourceDeviceId: args.sourceDeviceConvexId,
      encryptedPayload: args.encryptedPayload,
      createdAt: Date.now(),
    });
  },
});

export const listSyncEvents = query({
  args: {
    targetDeviceConvexId: v.id("devices"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      _id: v.id("deviceSyncEvents"),
      _creationTime: v.number(),
      targetDeviceId: v.id("devices"),
      sourceDeviceId: v.id("devices"),
      encryptedPayload: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deviceSyncEvents")
      .withIndex("by_target_device", (q) =>
        q.eq("targetDeviceId", args.targetDeviceConvexId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const uploadSyncArchive = mutation({
  args: {
    provisioningId: v.string(),
    encryptedArchive: v.string(),
    primaryDeviceId: v.string(),
    primaryDeviceConvexId: v.id("devices"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const primary = await ctx.db.get("devices", args.primaryDeviceConvexId);
    if (!primary || primary.deviceId !== args.primaryDeviceId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.insert("syncArchives", {
      provisioningId: args.provisioningId,
      encryptedArchive: args.encryptedArchive,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
    return null;
  },
});

export const getSyncArchive = query({
  args: { provisioningId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const archive = await ctx.db
      .query("syncArchives")
      .withIndex("by_provisioning_id", (q) =>
        q.eq("provisioningId", args.provisioningId),
      )
      .unique();
    if (!archive || archive.expiresAt < Date.now()) return null;
    return archive.encryptedArchive;
  },
});
