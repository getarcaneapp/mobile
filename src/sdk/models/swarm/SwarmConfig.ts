import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

export interface SwarmConfigSummary {
	id: string;
	version: JSONValue;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	spec: JSONValue;
}

export interface SwarmConfigCreateRequest {
	spec: JSONValue;
}

export interface SwarmConfigUpdateRequest {
	version?: number;
	spec: JSONValue;
}
