import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { EncryptedEnvelope } from "@/lib/crypto/types";
import type { LocalPreKeyStore } from "@/lib/crypto/x3dh";
import { decryptMessage } from "@/lib/storage/crypto-service";
import {
  loadMessageHistory,
  type HistoryMessage,
} from "@/lib/storage/message-history-store";

function dedupeKey(message: HistoryMessage): string {
  return `${message.conversationId}:${message.timestamp}:${message.direction}:${message.plaintext}`;
}

export async function collectSyncHistory(
  localStore: LocalPreKeyStore & { deviceId: string },
  accountId: Id<"accounts">,
  deviceConvexId: Id<"devices">,
): Promise<HistoryMessage[]> {
  const messages = await loadMessageHistory();
  const seen = new Set(messages.map(dedupeKey));

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const received = await client.query(api.messages.listReceivedForDeviceSync, {
    deviceConvexId,
    accountId,
  });

  for (const raw of received) {
    try {
      const envelope = JSON.parse(raw.envelope) as EncryptedEnvelope;
      const plaintext = await decryptMessage(
        localStore,
        raw.senderClientDeviceId,
        envelope,
      );
      const entry: HistoryMessage = {
        conversationId: raw.peerUsername,
        plaintext,
        timestamp: raw.createdAt,
        direction: "received",
      };
      const key = dedupeKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      messages.push(entry);
    } catch {
      // skip undecryptable messages
    }
  }

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}
