/** Port of Models/MobilePush/MobilePush.swift. */
import type { ISODateString } from '../base/date';
import { parseArcaneJSON } from '../../http/json';
import { D, DecodingError } from '../base/decoding';

/**
 * Feature flag advertised in `/app-version` `enabledFeatures` when the server
 * can pair mobile devices for native push notifications.
 */
export { mobilePushFeature } from '../../client/ServerCapabilities';

/** Notification event keys accepted in `MobilePushDevice.events`. */
export type MobilePushEvent =
	| 'image_update'
	| 'container_update'
	| 'vulnerability_found'
	| 'prune_report'
	| 'auto_heal';

export const MobilePushEvent = {
	imageUpdate: 'image_update',
	containerUpdate: 'container_update',
	vulnerabilityFound: 'vulnerability_found',
	pruneReport: 'prune_report',
	autoHeal: 'auto_heal',
	allCases: [
		'image_update',
		'container_update',
		'vulnerability_found',
		'prune_report',
		'auto_heal'
	] as const satisfies readonly MobilePushEvent[]
} as const;

/** A device registered with the Arcane server for mobile push. */
export interface MobilePushDevice {
	id: string;
	label: string;
	events: Record<string, boolean>;
	environmentIds: string[];
	createdAt: ISODateString;
	lastSeenAt?: ISODateString;
}

export const MobilePushDevice = {
	/** Swift init defaults (`events = [:]`, `environmentIds = []`). */
	make(
		init: Omit<MobilePushDevice, 'events' | 'environmentIds'> & {
			events?: Record<string, boolean>;
			environmentIds?: string[];
		}
	): MobilePushDevice {
		return { ...init, events: init.events ?? {}, environmentIds: init.environmentIds ?? [] };
	},

	isEnabled(device: MobilePushDevice, event: MobilePushEvent): boolean {
		return device.events[event] ?? false;
	}
} as const;

/** Server-wide mobile push status plus the caller's devices. */
export interface MobilePushStatus {
	enabled: boolean;
	channelId?: string;
	relayUrl: string;
	devices: MobilePushDevice[];
}

export const MobilePushStatus = {
	make(
		init: Omit<MobilePushStatus, 'devices'> & { devices?: MobilePushDevice[] }
	): MobilePushStatus {
		return { ...init, devices: init.devices ?? [] };
	}
} as const;

/** Short-lived token the app presents to the push relay's `POST /v1/pair`. */
export interface MobilePushPairingToken {
	token: string;
	channelId: string;
	expiresAt: ISODateString;
}

export interface MobilePushRegisterDevice {
	recipientId: string;
	label: string;
	events?: Record<string, boolean>;
	environmentIds?: string[];
}

export interface MobilePushUpdateDevice {
	label?: string;
	events?: Record<string, boolean>;
	environmentIds?: string[];
}

/** Swift `MobilePushRoute.Kind`. */
export type MobilePushRouteKind =
	| 'tab'
	| 'container'
	| 'image'
	| 'activities'
	| 'events'
	| 'environment';

const mobilePushRouteKindCases = [
	'tab',
	'container',
	'image',
	'activities',
	'events',
	'environment'
] as const satisfies readonly MobilePushRouteKind[];

export const MobilePushRouteKind = {
	tab: 'tab',
	container: 'container',
	image: 'image',
	activities: 'activities',
	events: 'events',
	environment: 'environment',
	decode(this: void, raw: unknown): MobilePushRouteKind {
		const value = D.str(raw);
		if (!(mobilePushRouteKindCases as readonly string[]).includes(value)) {
			throw new DecodingError(`Cannot initialize Kind from invalid String value ${value}`);
		}
		return value as MobilePushRouteKind;
	}
} as const;

/** Typed deep link carried in a push payload. */
export interface MobilePushRoute {
	kind: MobilePushRouteKind;
	tab?: string;
	environmentId?: string;
	id?: string;
}

export const MobilePushRoute = {
	/** Swift nested `MobilePushRoute.Kind`. */
	Kind: MobilePushRouteKind,

	decode(this: void, raw: unknown): MobilePushRoute {
		const o = D.object(raw, 'MobilePushRoute');
		return {
			kind: D.nested(o, 'kind', MobilePushRouteKind.decode),
			tab: D.optString(o, 'tab'),
			environmentId: D.optString(o, 'environmentId'),
			id: D.optString(o, 'id')
		};
	}
} as const;

export interface MobilePushResource {
	kind: string;
	id: string;
	name?: string;
}

/** The `arcane` dictionary inside an APNs payload delivered by the relay. */
export interface MobilePushPayload {
	v: number;
	eventId: string;
	occurredAt: ISODateString;
	type: string;
	severity: string;
	environmentId?: string;
	environmentName?: string;
	resource?: MobilePushResource;
	route: MobilePushRoute;
	channelId: string;
}

export const MobilePushPayload = {
	/** Swift init defaults (`v = 1`). */
	make(init: Omit<MobilePushPayload, 'v'> & { v?: number }): MobilePushPayload {
		return { ...init, v: init.v ?? 1 };
	},

	/** Validating decode of the synthesized `Codable` shape. */
	decode(raw: unknown): MobilePushPayload {
		const o = D.object(raw, 'MobilePushPayload');
		return {
			v: D.int(o, 'v'),
			eventId: D.string(o, 'eventId'),
			occurredAt: D.string(o, 'occurredAt'),
			type: D.string(o, 'type'),
			severity: D.string(o, 'severity'),
			environmentId: D.optString(o, 'environmentId'),
			environmentName: D.optString(o, 'environmentName'),
			resource: D.optNested(o, 'resource', (value) => {
				const r = D.object(value, 'MobilePushResource');
				return { kind: D.string(r, 'kind'), id: D.string(r, 'id'), name: D.optString(r, 'name') };
			}),
			route: D.nested(o, 'route', MobilePushRoute.decode),
			channelId: D.string(o, 'channelId')
		};
	},

	/**
	 * Swift `init?(userInfo:)`: decodes the `arcane` object from a notification
	 * payload (e.g. expo-notifications `request.content.data`). Returns
	 * `undefined` when it is missing or malformed.
	 */
	fromUserInfo(userInfo: Record<string, unknown>): MobilePushPayload | undefined {
		const arcane = userInfo['arcane'];
		if (!D.isRecord(arcane)) return undefined;
		// Round-trip through JSON like JSONSerialization (nulls dropped like the transport).
		return D.attempt(() => MobilePushPayload.decode(parseArcaneJSON(JSON.stringify(arcane))));
	}
} as const;
