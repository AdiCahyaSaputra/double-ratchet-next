"use client";

import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  text: string;
  isOwn: boolean;
  timestamp: number;
}

export function MessageBubble({ text, isOwn, timestamp }: MessageBubbleProps) {
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p className="text-sm">{text}</p>
        <p
          className={cn(
            "mt-1 text-xs",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {new Date(timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
