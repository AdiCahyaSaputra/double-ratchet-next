"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Users } from "lucide-react";

export function UserList() {
  const accounts = useQuery(api.accounts.listAccounts);

  if (accounts === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No users registered yet.</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y overflow-hidden p-0">
      {accounts.map((account) => (
        <Link
          key={account._id}
          href={`/chat/${account.username}`}
          className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <span className="font-medium">{account.username}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ))}
    </Card>
  );
}
