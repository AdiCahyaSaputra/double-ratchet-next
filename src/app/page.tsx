"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasLocalSession, signOut } from "@/lib/auth/session";
import { loadAccount } from "@/lib/storage/account-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, QrCode, Shield, Smartphone, LogOut } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void (async () => {
      const session = await hasLocalSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const account = await loadAccount();
      setHasAccount(true);
      setUsername(account?.username ?? null);
      setReady(true);
    })();
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  if (!hasAccount) {
    return null;
  }

  const navItems = [
    {
      href: "/users",
      icon: MessageSquare,
      label: "Browse users & chat",
      description: "Start an encrypted conversation",
    },
    {
      href: "/settings/devices",
      icon: Smartphone,
      label: "Manage linked devices",
      description: "View and unlink your devices",
    },
    {
      href: "/link",
      icon: QrCode,
      label: "Link this device",
      description: "Show a QR code for your primary device",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Double Ratchet</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground">{username}</span>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
        >
          <LogOut />
          Sign out
        </Button>
      </div>

      <nav className="flex flex-col gap-3">
        {navItems.map(({ href, icon: Icon, label, description }) => (
          <Link key={href} href={href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex-row items-center gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </nav>

      <Card className="mt-8">
        <CardContent className="pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Messages are encrypted with Double Ratchet + X3DH. Private keys stay
            on your device.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
