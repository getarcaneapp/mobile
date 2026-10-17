/** Port of Models/Swarm/SwarmTask.swift. */
import type { ISODateString } from '../base/date';

/** A swarm task summary (one row in a service's task list). */
export interface SwarmTaskSummary {
	id: string;
	name: string;
	serviceId: string;
	serviceName: string;
	nodeId: string;
	nodeName: string;
	desiredState: string;
	currentState: string;
	error?: string;
	containerId?: string;
	image?: string;
	slot?: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}
