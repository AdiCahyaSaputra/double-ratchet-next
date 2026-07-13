import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hashPassword, validatePassword, verifyPassword } from "./lib/password";

const publicAccountValidator = v.object({
  _id: v.id("accounts"),
  _creationTime: v.number(),
  username: v.string(),
  createdAt: v.number(),
});

function toPublicAccount(account: {
  _id: import("./_generated/dataModel").Id<"accounts">;
  _creationTime: number;
  username: string;
  createdAt: number;
}) {
  return {
    _id: account._id,
    _creationTime: account._creationTime,
    username: account.username,
    createdAt: account.createdAt,
  };
}

export const createAccount = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    deviceId: v.string(),
    deviceName: v.string(),
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
  },
  returns: v.object({
    accountId: v.id("accounts"),
    deviceConvexId: v.id("devices"),
  }),
  handler: async (ctx, args) => {
    const username = args.username.trim();
    if (!username) {
      throw new Error("Username is required");
    }

    validatePassword(args.password);

    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing) {
      throw new Error("Username already taken");
    }

    const { salt, hash } = await hashPassword(args.password);
    const now = Date.now();
    const accountId = await ctx.db.insert("accounts", {
      username,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: now,
    });

    const deviceConvexId = await ctx.db.insert("devices", {
      accountId,
      deviceId: args.deviceId,
      deviceName: args.deviceName,
      isPrimary: true,
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

    return { accountId, deviceConvexId };
  },
});

export const login = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: v.object({
    accountId: v.id("accounts"),
    username: v.string(),
  }),
  handler: async (ctx, args) => {
    const username = args.username.trim();
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (!account) {
      throw new Error("Invalid username or password");
    }

    if (!account.passwordSalt || !account.passwordHash) {
      throw new Error("Invalid username or password");
    }

    const valid = await verifyPassword(
      args.password,
      account.passwordSalt,
      account.passwordHash,
    );
    if (!valid) {
      throw new Error("Invalid username or password");
    }

    return { accountId: account._id, username: account.username };
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(publicAccountValidator, v.null()),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    return account ? toPublicAccount(account) : null;
  },
});

export const listAccounts = query({
  args: {},
  returns: v.array(publicAccountValidator),
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();
    return accounts.map(toPublicAccount);
  },
});

export const getSyncChannelKey = query({
  args: {
    deviceConvexId: v.id("devices"),
    deviceId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceConvexId);
    if (!device || device.deviceId !== args.deviceId) {
      throw new Error("Unauthorized device");
    }

    const account = await ctx.db.get("accounts", device.accountId);
    return account?.syncChannelKey ?? null;
  },
});

export const setSyncChannelKey = mutation({
  args: {
    deviceConvexId: v.id("devices"),
    deviceId: v.string(),
    syncChannelKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceConvexId);
    if (!device || device.deviceId !== args.deviceId) {
      throw new Error("Unauthorized device");
    }

    await ctx.db.patch(device.accountId, {
      syncChannelKey: args.syncChannelKey,
    });
    return null;
  },
});
