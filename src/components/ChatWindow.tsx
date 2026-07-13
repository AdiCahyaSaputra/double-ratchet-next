"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock, Send } from "lucide-react";

export interface ChatMessage {
  id: string;
  text: string;
  isOwn: boolean;
  timestamp: number;
}

interface ChatWindowProps {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  sending: boolean;
  peerUsername: string;
}

export function ChatWindow({
  messages,
  onSend,
  sending,
  peerUsername,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await onSend(text);
  }

  return (
    <Card className="flex h-[calc(100vh-8rem)] flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="font-semibold">{peerUsername}</h2>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" />
              End-to-end encrypted
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            text={msg.text}
            isOwn={msg.isOwn}
            timestamp={msg.timestamp}
          />
        ))}
        <div ref={bottomRef} />
      </CardContent>
      <CardFooter className="border-t">
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={sending || !input.trim()}
            size="icon"
          >
            <Send />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
