/** State behind `SwarmTasksView` + `SwarmTaskRow` (SwarmTasksView.swift). */
import type { EnvironmentID } from '@/sdk/client/environment';
import type { SwarmTaskSummary } from '@/sdk/models/swarm/SwarmTask';

import { shortID } from './swarm-common';
import type { SwarmTaskSource } from './swarm-routes';
import { useSwarmPagedList } from './use-swarm-list';

export function useSwarmTasks(environmentID: EnvironmentID, source: SwarmTaskSource) {
	return useSwarmPagedList<SwarmTaskSummary>(environmentID, (client, { envID, start, limit }) => {
		switch (source.kind) {
			case 'all':
				return client.swarm.listTasks({ envID, start, limit });
			case 'service':
				return client.swarm.serviceTasks({ serviceId: source.id, envID, start, limit });
			case 'stack':
				return client.swarm.stackTasks({ name: source.name, envID, start, limit });
			case 'node':
				return client.swarm.nodeTasks({ nodeId: source.id, envID, start, limit });
		}
	});
}

/** `SwarmTaskRow.title`. */
export function taskTitle(task: SwarmTaskSummary, showsService: boolean) {
	if (showsService && task.slot !== undefined) return `${task.serviceName}.${task.slot}`;
	if (task.slot !== undefined) return `Slot ${task.slot}`;
	return task.name === '' ? shortID(task.id) : task.name;
}

export const taskNodeName = (task: SwarmTaskSummary) =>
	task.nodeName === '' ? shortID(task.nodeId) : task.nodeName;

export const showsServiceFor = (source: SwarmTaskSource, task: SwarmTaskSummary) =>
	!(source.kind === 'service' && source.id === task.serviceId);

/** Route params → `SwarmTasksView.Source`. */
export function taskSourceFromParams(source?: string, value?: string): SwarmTaskSource {
	switch (source) {
		case 'service':
			return { kind: 'service', id: value ?? '' };
		case 'stack':
			return { kind: 'stack', name: value ?? '' };
		case 'node':
			return { kind: 'node', id: value ?? '' };
		default:
			return { kind: 'all' };
	}
}
