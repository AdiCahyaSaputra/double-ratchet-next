import type { RatchetState, SerializedRatchetState } from "../crypto/types";

export const MAX_INACTIVE = 5;

export interface SessionEntry {
  id: string;
  ratchetState: RatchetState;
  createdAt: number;
}

export interface DeviceRecord {
  remoteDeviceId: string;
  activeSession: SessionEntry | null;
  inactiveSessions: SessionEntry[];
}

export function createDeviceRecord(remoteDeviceId: string): DeviceRecord {
  return {
    remoteDeviceId,
    activeSession: null,
    inactiveSessions: [],
  };
}

export function insertSession(
  record: DeviceRecord,
  session: SessionEntry,
): DeviceRecord {
  const inactive = record.activeSession
    ? [record.activeSession, ...record.inactiveSessions].slice(0, MAX_INACTIVE)
    : record.inactiveSessions;
  return {
    ...record,
    activeSession: session,
    inactiveSessions: inactive,
  };
}

export function promoteSession(
  record: DeviceRecord,
  sessionId: string,
): DeviceRecord {
  const inactive = record.inactiveSessions.find((s) => s.id === sessionId);
  if (!inactive) return record;
  const remaining = record.inactiveSessions.filter((s) => s.id !== sessionId);
  const newInactive = record.activeSession
    ? [record.activeSession, ...remaining].slice(0, MAX_INACTIVE)
    : remaining;
  return {
    ...record,
    activeSession: inactive,
    inactiveSessions: newInactive,
  };
}

export function updateActiveSession(
  record: DeviceRecord,
  ratchetState: RatchetState,
): DeviceRecord {
  if (!record.activeSession) return record;
  return {
    ...record,
    activeSession: { ...record.activeSession, ratchetState },
  };
}

export interface SerializedDeviceRecord {
  remoteDeviceId: string;
  activeSession: {
    id: string;
    ratchetState: SerializedRatchetState;
    createdAt: number;
  } | null;
  inactiveSessions: Array<{
    id: string;
    ratchetState: SerializedRatchetState;
    createdAt: number;
  }>;
}
