import { get, set, del, createStore } from "idb-keyval";

// Separate DB name — see identity-store.ts for why we avoid sharing one DB.
const store = createStore("double-ratchet-account", "keyval");

const ACCOUNT_KEY = "account-store";

export interface AccountInfo {
  accountId: string;
  username: string;
  convexDeviceId: string;
  isPrimary: boolean;
  syncChannelKey?: string;
  linkedDevices: Array<{
    deviceId: string;
    deviceName: string;
    isPrimary: boolean;
  }>;
}

export async function loadAccount(): Promise<AccountInfo | null> {
  const account = await get<AccountInfo>(ACCOUNT_KEY, store);
  return account ?? null;
}

export async function saveAccount(account: AccountInfo): Promise<void> {
  await set(ACCOUNT_KEY, account, store);
}

export async function clearAccount(): Promise<void> {
  await del(ACCOUNT_KEY, store);
}

export async function updateSyncChannelKey(key: string): Promise<void> {
  const account = await loadAccount();
  if (!account) return;
  await saveAccount({ ...account, syncChannelKey: key });
}
