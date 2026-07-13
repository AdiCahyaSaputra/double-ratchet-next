import { loadAccount } from "@/lib/storage/account-store";
import { loadIdentityStore } from "@/lib/storage/identity-store";
import { loadPendingAuth } from "@/lib/auth/pending-auth";

export async function hasLocalSession(): Promise<boolean> {
  const [account, identity] = await Promise.all([
    loadAccount(),
    loadIdentityStore(),
  ]);
  return !!account && !!identity;
}

export function hasPendingAuth(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return loadPendingAuth() !== null;
}

export async function signOut(): Promise<void> {
  const { clearAccount } = await import("@/lib/storage/account-store");
  const { clearIdentityStore } = await import("@/lib/storage/identity-store");
  const { clearAllSessions } = await import("@/lib/storage/session-store");
  const { clearPendingAuth } = await import("@/lib/auth/pending-auth");

  await Promise.all([clearAccount(), clearIdentityStore(), clearAllSessions()]);
  clearPendingAuth();
}
