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

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	status(): Promise<MobilePushStatus> {
		return this.rest.get('apns/status');
	}

	pairingToken(): Promise<MobilePushPairingToken> {
		return this.rest.post('apns/pairing-token');
	}

	registerDevice(args: { body: MobilePushRegisterDevice }): Promise<MobilePushDevice> {
		return this.rest.post('apns/devices', { body: args.body });
	}

	updateDevice(args: { id: string; body: MobilePushUpdateDevice }): Promise<MobilePushDevice> {
		return this.rest.patch(`apns/devices/${args.id}`, { body: args.body });
	}

	deleteDevice(args: { id: string }): Promise<void> {
		return this.rest.deleteVoid(`apns/devices/${args.id}`);
	}

	testDevice(args: { id: string }): Promise<void> {
		return this.rest.postVoid(`apns/devices/${args.id}/test`);
	}
}
