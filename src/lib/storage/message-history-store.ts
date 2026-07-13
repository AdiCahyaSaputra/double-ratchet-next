import { get, set, del, createStore } from "idb-keyval";

const store = createStore("double-ratchet-message-history", "keyval");
const HISTORY_KEY = "message-history";

export interface HistoryMessage {
  conversationId: string;
  plaintext: string;
  timestamp: number;
  direction: "sent" | "received";
}

function dedupeKey(message: HistoryMessage): string {
  return `${message.conversationId}:${message.timestamp}:${message.direction}:${message.plaintext}`;
}

export async function loadMessageHistory(): Promise<HistoryMessage[]> {
  return (await get<HistoryMessage[]>(HISTORY_KEY, store)) ?? [];
}

export async function appendMessageHistory(
  message: HistoryMessage,
): Promise<void> {
  const history = await loadMessageHistory();
  const key = dedupeKey(message);
  if (history.some((entry) => dedupeKey(entry) === key)) return;
  await set(HISTORY_KEY, [...history, message], store);
}

export async function importMessageHistory(
  messages: HistoryMessage[],
): Promise<void> {
  const history = await loadMessageHistory();
  const seen = new Set(history.map(dedupeKey));
  const merged = [...history];

  for (const message of messages) {
    const key = dedupeKey(message);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(message);
  }

  merged.sort((a, b) => a.timestamp - b.timestamp);
  await set(HISTORY_KEY, merged, store);
}

export async function clearMessageHistory(): Promise<void> {
  await del(HISTORY_KEY, store);
}
