import type { EncryptedEnvelope, PreKeyBundle } from "../crypto/types";
import type { SesameContext } from "./sesame";
import { encryptForDevice } from "./sesame";

export interface RemoteDevice {
  deviceId: string;
  convexDeviceId: string;
  preKeyBundle: PreKeyBundle;
}

export interface FanoutResult {
  deviceId: string;
  convexDeviceId: string;
  envelope: EncryptedEnvelope;
}

export async function fanoutEncrypt(
  ctx: SesameContext,
  remoteDevices: RemoteDevice[],
  plaintext: string,
): Promise<FanoutResult[]> {
  const results: FanoutResult[] = [];
  for (const device of remoteDevices) {
    const { envelopes } = await encryptForDevice(
      ctx,
      device.deviceId,
      device.preKeyBundle,
      plaintext,
    );
    const envelope = envelopes[0];
    if (envelope) {
      results.push({
        deviceId: device.deviceId,
        convexDeviceId: device.convexDeviceId,
        envelope,
      });
    }
  }
  return results;
}
