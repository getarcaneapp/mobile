/** Port of Models/Swarm/SwarmSecret.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

/** A swarm secret (named, write-only blob mountable into services). */
export interface SwarmSecretSummary {
	id: string;
	version: JSONValue;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	spec: JSONValue;
}

/** Body for creating a swarm secret (`spec` is the raw Docker SecretSpec). */
export interface SwarmSecretCreateRequest {
	spec: JSONValue;
}

/** Body for updating a swarm secret. */
export interface SwarmSecretUpdateRequest {
	version?: number;
	spec: JSONValue;
}
