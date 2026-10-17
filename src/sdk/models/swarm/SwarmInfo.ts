/** Port of Models/Swarm/SwarmInfo.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

/** Runtime status reflecting whether swarm mode is enabled in this environment. */
export interface SwarmRuntimeStatus {
	enabled: boolean;
}

/**
 * Top-level information about the swarm cluster. The full Docker `Spec` blob
 * is preserved as opaque JSON.
 */
export interface SwarmInfo {
	id: string;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	spec: JSONValue;
	rootRotationInProgress: boolean;
}
