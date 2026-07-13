"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasLocalSession, hasPendingAuth } from "@/lib/auth/session";
import { Skeleton } from "@/components/ui/skeleton";

interface UseRequireAuthOptions {
  allowPendingLink?: boolean;
}

export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    void (async () => {
      const hasSession = await hasLocalSession();
      if (hasSession) {
        setAuthenticated(true);
        setReady(true);
        return;
      }

      if (options.allowPendingLink && hasPendingAuth()) {
        setAuthenticated(true);
        setReady(true);
        return;
      }

      router.replace("/login");
    })();
  }, [router, options.allowPendingLink]);

  return { ready, authenticated };
}

export function AuthLoading() {
  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <Skeleton className="mb-6 h-8 w-20" />
      <Skeleton className="mb-6 h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </main>
  );
}
