import { D } from '../base/decoding';

export interface EnvironmentChanges {
	environmentID: string;
	epoch: string;
	kinds: Record<string, number>;
}

export const EnvironmentChanges = {
	decode(this: void, raw: unknown): EnvironmentChanges {
		const o = D.object(raw, 'EnvironmentChanges');
		const kinds: Record<string, number> = {};
		const rawKinds = o.kinds;
		if (typeof rawKinds === 'object' && rawKinds !== null && !Array.isArray(rawKinds)) {
			for (const [kind, revision] of Object.entries(rawKinds)) {
				if (typeof revision === 'number') kinds[kind] = revision;
			}
		}
		return {
			environmentID: D.string(o, 'environmentId'),
			epoch: D.optString(o, 'epoch') ?? '',
			kinds
		};
	}
} as const;

export interface EnvironmentChangesEvent {
	changes: EnvironmentChanges[];
}

export const EnvironmentChangesEvent = {
	decode(this: void, raw: unknown): EnvironmentChangesEvent {
		const envelope = D.object(raw, 'EnvironmentChangesEvent');
		const payload = envelope.channel === 'events' ? envelope.eventLog : envelope;
		if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
			return { changes: [] };
		}
		return {
			changes: D.optArray(D.object(payload), 'changes', EnvironmentChanges.decode) ?? []
		};
	}
} as const;
