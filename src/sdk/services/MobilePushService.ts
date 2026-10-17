/**
 * Port of Services/MobilePushService.swift: pairs this device with the Arcane
 * server for native push notifications. All endpoints live under `/apns` and
 * act on the calling user.
 */
import type { RESTService } from '../http/RESTService';
import type {
	MobilePushDevice,
	MobilePushPairingToken,
	MobilePushRegisterDevice,
	MobilePushStatus,
	MobilePushUpdateDevice
} from '../models/mobilePush/MobilePush';

export class MobilePushService {
	private readonly rest: RESTService;

	/** @internal */
	constructor(rest: RESTService) {
		this.rest = rest;
	}

	/** Whether mobile push is enabled server-side plus the caller's devices. */
	status(): Promise<MobilePushStatus> {
		return this.rest.get('apns/status');
	}

	/** Issues a short-lived signed pairing token for the push relay. */
	pairingToken(): Promise<MobilePushPairingToken> {
		return this.rest.post('apns/pairing-token');
	}

	/** Registers the relay `recipientId` returned by pairing. */
	registerDevice(args: { body: MobilePushRegisterDevice }): Promise<MobilePushDevice> {
		return this.rest.post('apns/devices', { body: args.body });
	}

	updateDevice(args: { id: string; body: MobilePushUpdateDevice }): Promise<MobilePushDevice> {
		return this.rest.patch(`apns/devices/${args.id}`, { body: args.body });
	}

	deleteDevice(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`apns/devices/${args.id}`);
	}

	/** Sends a test notification to one of the caller's devices. */
	testDevice(args: { id: string }): Promise<void> {
		return this.rest.postVoid(`apns/devices/${args.id}/test`);
	}
}
