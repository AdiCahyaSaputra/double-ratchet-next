import { get, set, del, createStore } from "idb-keyval";
import {
  createDeviceRecord,
  type DeviceRecord,
  type SerializedDeviceRecord,
} from "../sesame/device-record";
import {
  deserializeRatchetState,
  serializeRatchetState,
} from "../crypto/double-ratchet";

// Separate DB name — see identity-store.ts for why we avoid sharing one DB.
const store = createStore("double-ratchet-sessions", "keyval");

function sessionKey(remoteDeviceId: string): string {
  return `session:${remoteDeviceId}`;
}

function serializeRecord(record: DeviceRecord): SerializedDeviceRecord {
  return {
    remoteDeviceId: record.remoteDeviceId,
    activeSession: record.activeSession
      ? {
          id: record.activeSession.id,
          ratchetState: serializeRatchetState(record.activeSession.ratchetState),
          createdAt: record.activeSession.createdAt,
        }
      : null,
    inactiveSessions: record.inactiveSessions.map((s) => ({
      id: s.id,
      ratchetState: serializeRatchetState(s.ratchetState),
      createdAt: s.createdAt,
    })),
  };
}

function deserializeRecord(data: SerializedDeviceRecord): DeviceRecord {
  return {
    remoteDeviceId: data.remoteDeviceId,
    activeSession: data.activeSession
      ? {
          id: data.activeSession.id,
          ratchetState: deserializeRatchetState(data.activeSession.ratchetState),
          createdAt: data.activeSession.createdAt,
        }
      : null,
    inactiveSessions: data.inactiveSessions.map((s) => ({
      id: s.id,
      ratchetState: deserializeRatchetState(s.ratchetState),
      createdAt: s.createdAt,
    })),
  };
}

export async function getDeviceRecord(
  remoteDeviceId: string,
): Promise<DeviceRecord | null> {
  const data = await get<SerializedDeviceRecord>(sessionKey(remoteDeviceId), store);
  return data ? deserializeRecord(data) : null;
}

export async function saveDeviceRecord(record: DeviceRecord): Promise<void> {
  await set(sessionKey(record.remoteDeviceId), serializeRecord(record), store);
}

export async function getOrCreateDeviceRecord(
  remoteDeviceId: string,
): Promise<DeviceRecord> {
  const existing = await getDeviceRecord(remoteDeviceId);
  return existing ?? createDeviceRecord(remoteDeviceId);
}

export async function listAllDeviceRecords(): Promise<DeviceRecord[]> {
  // idb-keyval doesn't support list; store keys in a manifest
  const manifest = await get<string[]>("session-manifest", store);
  if (!manifest) return [];
  const records: DeviceRecord[] = [];
  for (const id of manifest) {
    const record = await getDeviceRecord(id);
    if (record) records.push(record);
  }
  return records;
}

export async function trackDeviceRecord(remoteDeviceId: string): Promise<void> {
  const manifest = (await get<string[]>("session-manifest", store)) ?? [];
  if (!manifest.includes(remoteDeviceId)) {
    await set("session-manifest", [...manifest, remoteDeviceId], store);
  }
}

export async function importDeviceRecord(record: DeviceRecord): Promise<void> {
  await saveDeviceRecord(record);
  await trackDeviceRecord(record.remoteDeviceId);
}

export async function clearAllSessions(): Promise<void> {
  const manifest = (await get<string[]>("session-manifest", store)) ?? [];
  await Promise.all(manifest.map((id) => del(sessionKey(id), store)));
  await del("session-manifest", store);
}
