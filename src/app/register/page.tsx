"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { toBase64 } from "@/lib/crypto/bytes";
import { detectDeviceName } from "@/lib/device-name";
import { ensureIdentityStore } from "@/lib/storage/identity-store";
import { saveAccount } from "@/lib/storage/account-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const createAccount = useMutation(api.accounts.createAccount);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deviceName, setDeviceName] = useState(() => detectDeviceName());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.SubmitEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const identity = await ensureIdentityStore();
      const result = await createAccount({
        username: username.trim(),
        password,
        deviceId: identity.deviceId,
        deviceName: deviceName.trim() || detectDeviceName(),
        identityPublicKey: toBase64(identity.identity.identityKey.publicKey),
        signingPublicKey: toBase64(identity.identity.signingKey.publicKey),
        registrationId: identity.identity.registrationId,
        signedPreKeyId: identity.signedPreKey.keyId,
        signedPreKeyPublic: toBase64(identity.signedPreKey.keyPair.publicKey),
        signedPreKeySignature: toBase64(identity.signedPreKey.signature),
        oneTimePreKeys: identity.oneTimePreKeys.map((opk) => ({
          keyId: opk.keyId,
          publicKey: toBase64(opk.keyPair.publicKey),
        })),
      });

      await saveAccount({
        accountId: result.accountId,
        username: username.trim(),
        convexDeviceId: result.deviceConvexId,
        isPrimary: true,
        linkedDevices: [
          {
            deviceId: identity.deviceId,
            deviceName: deviceName.trim() || detectDeviceName(),
            isPrimary: true,
          },
        ],
      });

      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>
            Register with a username and password. Encryption keys are generated
            locally on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="alice"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repeat password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deviceName">This device</Label>
              <Input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Chrome on macOS"
              />
              <p className="text-xs text-muted-foreground">
                Auto-detected from your browser. You can edit it.
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
