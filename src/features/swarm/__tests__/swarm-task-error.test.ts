import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import type { SwarmTaskSummary } from '@/sdk/models/swarm/SwarmTask';

import { taskErrorMessage } from '../swarm-task-error';

const task = (currentState: string, error?: string) =>
	({ currentState, error }) as unknown as SwarmTaskSummary;

describe('taskErrorMessage', () => {
	it('hides status messages on healthy tasks', () => {
		assert.equal(taskErrorMessage(task('running', 'started')), undefined);
	});

	it('shows the message for failed tasks', () => {
		assert.equal(
			taskErrorMessage(task('failed', 'task: non-zero exit (1)')),
			'task: non-zero exit (1)'
		);
	});
});
