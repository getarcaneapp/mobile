import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	activityProgress,
	backupRunOutcome,
	buildStepProgress,
	createPullProgress
} from '../operation-progress';

describe('createPullProgress', () => {
	it('starts indeterminate and ignores the repository line', () => {
		const tracker = createPullProgress();
		assert.deepEqual(tracker.apply({ id: 'latest', status: 'Pulling from library/nginx' }), {
			phase: 'Pulling',
			progress: undefined
		});
	});

	it('weights downloads and extraction across layers by size', () => {
		const tracker = createPullProgress();
		tracker.apply({ id: 'a', status: 'Pulling fs layer' });
		tracker.apply({ id: 'b', status: 'Pulling fs layer' });
		tracker.apply({ id: 'a', status: 'Downloading', progressDetail: { current: 0, total: 100 } });
		const first = tracker.apply({
			id: 'b',
			status: 'Downloading',
			progressDetail: { current: 150, total: 300 }
		});
		assert.equal(first.phase, 'Downloading');
		assert.equal(first.progress, 0.28125);
		tracker.apply({ id: 'a', status: 'Download complete' });
		const second = tracker.apply({ id: 'b', status: 'Download complete' });
		assert.equal(second.phase, 'Extracting');
		assert.equal(second.progress, 0.75);
		const extracting = tracker.apply({
			id: 'a',
			status: 'Extracting',
			progressDetail: { current: 100, total: 100 }
		});
		assert.equal(extracting.phase, 'Extracting');
		assert.equal(extracting.progress, 0.8125);
		tracker.apply({ id: 'a', status: 'Pull complete' });
		const done = tracker.apply({ id: 'b', status: 'Pull complete' });
		assert.equal(done.progress, 1);
		assert.equal(tracker.apply({ status: 'Digest: sha256:abc' }).phase, 'Finishing');
	});

	it('stays downloading while layers are waiting', () => {
		const tracker = createPullProgress();
		tracker.apply({ id: 'a', status: 'Waiting' });
		const update = tracker.apply({
			id: 'b',
			status: 'Extracting',
			progressDetail: { current: 10, total: 100 }
		});
		assert.equal(update.phase, 'Downloading');
	});

	it('never moves progress backwards when new layers appear', () => {
		const tracker = createPullProgress();
		tracker.apply({ id: 'a', status: 'Downloading', progressDetail: { current: 90, total: 100 } });
		const update = tracker.apply({
			id: 'b',
			status: 'Downloading',
			progressDetail: { current: 0, total: 900 }
		});
		assert.equal(update.progress, 0.675);
	});

	it('ignores layers that already exist', () => {
		const tracker = createPullProgress();
		const update = tracker.apply({ id: 'a', status: 'Already exists' });
		assert.equal(update.progress, undefined);
	});
});

describe('buildStepProgress', () => {
	it('parses classic builder steps', () => {
		assert.deepEqual(buildStepProgress({ stream: 'Step 3/5 : RUN npm ci\n' }), {
			phase: 'Step 3/5',
			progress: 0.4
		});
	});

	it('parses BuildKit steps with stage names and services', () => {
		assert.deepEqual(buildStepProgress({ log: '#7 [build 2/4] COPY . .', service: 'web' }), {
			phase: 'web: Step 2/4',
			progress: 0.25
		});
		assert.deepEqual(buildStepProgress({ stream: '#5 [1/2] FROM docker.io/library/node' }), {
			phase: 'Step 1/2',
			progress: 0
		});
	});

	it('ignores other output', () => {
		assert.equal(buildStepProgress({ stream: '#1 [internal] load build definition' }), undefined);
		assert.equal(buildStepProgress({ stream: ' ---> Running in 1234' }), undefined);
		assert.equal(buildStepProgress({ status: 'Downloading' }), undefined);
		assert.equal(buildStepProgress({ stream: 'Step 0/0 : FROM x' }), undefined);
	});
});

describe('activityProgress', () => {
	it('maps running activities to their step and percent', () => {
		assert.deepEqual(
			activityProgress({ status: 'running', step: 'Uploading to S3', progress: 40 }, 'Working'),
			{ phase: 'Uploading to S3', progress: 0.4 }
		);
		assert.deepEqual(activityProgress({ status: 'running', step: ' ' }, 'Working'), {
			phase: 'Working',
			progress: undefined
		});
	});

	it('maps terminal statuses to outcomes', () => {
		assert.equal(activityProgress({ status: 'success', step: '' }, 'Working')?.outcome, 'success');
		assert.equal(activityProgress({ status: 'failed', step: '' }, 'Working')?.outcome, 'failure');
		assert.equal(
			activityProgress({ status: 'cancelled', step: '' }, 'Working')?.outcome,
			'cancelled'
		);
		assert.equal(activityProgress({ status: 'unknown', step: '' }, 'Working'), undefined);
	});
});

describe('backupRunOutcome', () => {
	it('maps backup run statuses', () => {
		assert.equal(backupRunOutcome('running'), undefined);
		assert.equal(backupRunOutcome('succeeded'), 'success');
		assert.equal(backupRunOutcome('Failed'), 'failure');
		assert.equal(backupRunOutcome('canceled'), 'cancelled');
	});
});
