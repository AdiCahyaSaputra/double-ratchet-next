import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const TABLES = [
  "deviceSyncEvents",
  "messages",
  "syncArchives",
  "provisioningMessages",
  "provisioningRequests",
  "prekeyBundles",
  "devices",
  "accounts",
] as const;

export const clearAll = internalMutation({
  args: {},
  returns: v.array(
    v.object({
      table: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const deleted: Array<{ table: string; count: number }> = [];

    for (const table of TABLES) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) {
        await ctx.db.delete(table, doc._id);
      }
      deleted.push({ table, count: docs.length });
    }

    return deleted;
  },
});
