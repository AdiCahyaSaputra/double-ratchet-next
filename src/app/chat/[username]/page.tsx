"use client";

import Link from "next/link";
import { use } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { useEncryptedChat } from "@/hooks/useEncryptedChat";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useRequireAuth, AuthLoading } from "@/hooks/useRequireAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function ChatPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { ready } = useRequireAuth();
  const { username } = use(params);
  const { messages, send, sending, error } = useEncryptedChat(username);
  const { syncedMessages } = useDeviceSync();

  const syncedForPeer = syncedMessages
    .filter((m) => m.conversationId === username)
    .map((m) => ({
      id: `sync-${m.timestamp}`,
      text: m.plaintext,
      isOwn: true,
      timestamp: m.timestamp,
    }));

  const allMessages = [...messages, ...syncedForPeer].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  const deduped = allMessages.filter(
    (msg, i, arr) =>
      arr.findIndex(
        (m) => m.text === msg.text && m.timestamp === msg.timestamp,
      ) === i,
  );

  if (!ready) {
    return <AuthLoading />;
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" nativeButton={false} render={<Link href="/users" />}>
        <ArrowLeft />
        Users
      </Button>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ChatWindow
        messages={deduped}
        onSend={send}
        sending={sending}
        peerUsername={username}
      />
    </main>
  );
}
