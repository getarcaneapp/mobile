import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

export interface SwarmSecretSummary {
	id: string;
	version: JSONValue;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	spec: JSONValue;
}

export interface SwarmSecretCreateRequest {
	spec: JSONValue;
}

export interface SwarmSecretUpdateRequest {
	version?: number;
	spec: JSONValue;
}
