import type { SwarmTaskSummary } from '@/sdk/models/swarm/SwarmTask';

const failedTaskStates = new Set(['failed', 'rejected', 'orphaned']);

export function taskErrorMessage(task: SwarmTaskSummary): string | undefined {
	const message = task.error?.trim();
	if (!message) return undefined;
	return failedTaskStates.has(task.currentState.toLowerCase()) ? message : undefined;
}
