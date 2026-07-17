const PENDING_AUTH_KEY = "pendingAuth";

export interface PendingAuth {
  accountId: string;
  username: string;
}

export function savePendingAuth(auth: PendingAuth): void {
  sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(auth));
}

export function loadPendingAuth(): PendingAuth | null {
	if (typeof sessionStorage === "undefined") return null;

  const raw = sessionStorage.getItem(PENDING_AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAuth;
  } catch {
    return null;
  }
}

export function clearPendingAuth(): void {
  sessionStorage.removeItem(PENDING_AUTH_KEY);
}
