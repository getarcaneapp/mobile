/** Port of Models/Swarm/SwarmConfig.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

/** A swarm config (named blob mountable into services). */
export interface SwarmConfigSummary {
	id: string;
	version: JSONValue;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	spec: JSONValue;
}

/** Body for creating a swarm config (`spec` is the raw Docker ConfigSpec). */
export interface SwarmConfigCreateRequest {
	spec: JSONValue;
}

/** Body for updating a swarm config. */
export interface SwarmConfigUpdateRequest {
	version?: number;
	spec: JSONValue;
}
