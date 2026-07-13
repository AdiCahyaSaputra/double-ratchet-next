import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  loadAccount,
  updateSyncChannelKey,
  type AccountInfo,
} from "@/lib/storage/account-store";
import { ensureIdentityStore } from "@/lib/storage/identity-store";

export async function ensureSyncChannelKey(): Promise<AccountInfo | null> {
  const [acct, identity] = await Promise.all([
    loadAccount(),
    ensureIdentityStore(),
  ]);
  if (!acct) return null;

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const deviceArgs = {
    deviceConvexId: acct.convexDeviceId as Id<"devices">,
    deviceId: identity.deviceId,
  };

  if (acct.syncChannelKey) {
    await client.mutation(api.accounts.setSyncChannelKey, {
      ...deviceArgs,
      syncChannelKey: acct.syncChannelKey,
    });
    return acct;
  }

  const serverKey = await client.query(api.accounts.getSyncChannelKey, deviceArgs);
  if (!serverKey) return acct;

  await updateSyncChannelKey(serverKey);
  return { ...acct, syncChannelKey: serverKey };
}
