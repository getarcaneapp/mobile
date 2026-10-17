import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

export interface SwarmRuntimeStatus {
	enabled: boolean;
}

export interface SwarmInfo {
	id: string;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	spec: JSONValue;
	rootRotationInProgress: boolean;
}
