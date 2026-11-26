import type { ISODateString } from '../base/date';
import { D, object } from '../base/decoding';

export interface PodmanSecret {
	id: string;
	name: string;
	driver: string;
	labels?: Record<string, string>;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	environmentId?: string;
}

export const PodmanSecret = {
	decode(this: void, raw: unknown): PodmanSecret {
		const o = object(raw, 'PodmanSecret');
		const spec = D.has(o, 'spec') ? object(o.spec, 'spec') : {};
		const driver = D.has(spec, 'driver') ? object(spec.driver, 'driver') : {};
		const id = D.string(o, 'id');
		return {
			id,
			name: D.optString(spec, 'name') || id.slice(0, 12),
			driver: D.optString(driver, 'name') || 'file',
			labels: D.optRecord(spec, 'labels', D.str),
			createdAt: D.optString(o, 'createdAt') ?? '',
			updatedAt: D.optString(o, 'updatedAt') ?? '',
			environmentId: D.optString(o, 'environmentId') || undefined
		};
	}
} as const;

export interface PodmanSecretCreateRequest {
	name: string;
	data: string;
	driver?: string;
	driverOptions?: Record<string, string>;
	labels?: Record<string, string>;
}

export type PodmanSecretUpdateRequest = Omit<PodmanSecretCreateRequest, 'name'>;

export interface PodmanSecretCreateResponse {
	id: string;
}
