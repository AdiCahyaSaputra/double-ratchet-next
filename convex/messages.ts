import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

async function resolvePeerUsername(
  ctx: QueryCtx,
  ownAccountId: Id<"accounts">,
  peerDeviceConvexId: Id<"devices">,
): Promise<string | null> {
  const device = await ctx.db.get("devices", peerDeviceConvexId);
  if (!device || device.accountId === ownAccountId) return null;

  const account = await ctx.db.get("accounts", device.accountId);
  return account?.username ?? null;
}

const messageDocValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  senderDeviceId: v.id("devices"),
  recipientDeviceId: v.id("devices"),
  envelope: v.string(),
  createdAt: v.number(),
});

export const send = mutation({
  args: {
    senderDeviceId: v.string(),
    senderDeviceConvexId: v.id("devices"),
    recipientDeviceConvexId: v.id("devices"),
    envelope: v.string(),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const sender = await ctx.db.get("devices", args.senderDeviceConvexId);
    if (!sender || sender.deviceId !== args.senderDeviceId) {
      throw new Error("Unauthorized sender");
    }

    return await ctx.db.insert("messages", {
      senderDeviceId: args.senderDeviceConvexId,
      recipientDeviceId: args.recipientDeviceConvexId,
      envelope: args.envelope,
      createdAt: Date.now(),
    });
  },
});

export const listForDevice = query({
  args: {
    recipientDeviceConvexId: v.id("devices"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(messageDocValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_recipient_device", (q) =>
        q.eq("recipientDeviceId", args.recipientDeviceConvexId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listReceivedForDeviceSync = query({
  args: {
    deviceConvexId: v.id("devices"),
    accountId: v.id("accounts"),
  },
  returns: v.array(
    v.object({
      peerUsername: v.string(),
      envelope: v.string(),
      senderClientDeviceId: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const received = await ctx.db
      .query("messages")
      .withIndex("by_recipient_device", (q) =>
        q.eq("recipientDeviceId", args.deviceConvexId),
      )
      .collect();

    const results: Array<{
      peerUsername: string;
      envelope: string;
      senderClientDeviceId: string;
      createdAt: number;
    }> = [];

    for (const message of received) {
      const peerUsername = await resolvePeerUsername(
        ctx,
        args.accountId,
        message.senderDeviceId,
      );
      if (!peerUsername) continue;

      const senderDevice = await ctx.db.get("devices", message.senderDeviceId);
      if (!senderDevice) continue;

      results.push({
        peerUsername,
        envelope: message.envelope,
        senderClientDeviceId: senderDevice.deviceId,
        createdAt: message.createdAt,
      });
    }

    return results;
  },
});

export const listConversation = query({
  args: {
    deviceConvexId: v.id("devices"),
    peerDeviceConvexId: v.id("devices"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(messageDocValidator),
  handler: async (ctx, args) => {
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q
          .eq("senderDeviceId", args.deviceConvexId)
          .eq("recipientDeviceId", args.peerDeviceConvexId),
      )
      .order("desc")
      .take(args.paginationOpts.numItems);

    const received = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q
          .eq("senderDeviceId", args.peerDeviceConvexId)
          .eq("recipientDeviceId", args.deviceConvexId),
      )
      .order("desc")
      .take(args.paginationOpts.numItems);

    const combined = [...sent, ...received].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    const page = combined.slice(0, args.paginationOpts.numItems);

    return {
      page,
      isDone: page.length < args.paginationOpts.numItems,
      continueCursor: args.paginationOpts.cursor ?? "",
      splitCursor: null,
      pageStatus: null,
    };
  },
});
