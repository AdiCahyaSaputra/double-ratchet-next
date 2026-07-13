"use client";

import Link from "next/link";
import { UserList } from "@/components/UserList";
import { useRequireAuth, AuthLoading } from "@/hooks/useRequireAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function UsersPage() {
  const { ready } = useRequireAuth();

  if (!ready) {
    return <AuthLoading />;
  }

  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <Button variant="ghost" size="sm" className="mb-6 -ml-2" nativeButton={false} render={<Link href="/" />}>
        <ArrowLeft />
        Home
      </Button>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Users</h1>
      <UserList />
    </main>
  );
}
