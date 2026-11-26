import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	autoUpdateUpdatedLabel,
	autoUpdateUpdatedStatus,
	isRunningPod,
	memoryLimitLabel,
	podActions,
	podmanBadgeStatus,
	podmanStateLabel,
	podmanStateVariant,
	quadletActions,
	quadletFileNameError
} from '../podman-logic';

describe('podmanStateVariant', () => {
	it('maps pod, container and unit states like the web UI', () => {
		assert.equal(podmanStateVariant('Running'), 'running');
		assert.equal(podmanStateVariant('active'), 'running');
		assert.equal(podmanStateVariant('Exited'), 'stopped');
		assert.equal(podmanStateVariant('inactive'), 'stopped');
		assert.equal(podmanStateVariant('failed'), 'stopped');
		assert.equal(podmanStateVariant('Paused'), 'paused');
		assert.equal(podmanStateVariant('Degraded'), 'starting');
		assert.equal(podmanStateVariant('activating'), 'starting');
		assert.equal(podmanStateVariant('Not loaded'), 'unknown');
		assert.equal(podmanStateVariant(undefined), 'unknown');
	});
});

describe('podmanBadgeStatus', () => {
	it('keeps failures red and passes unknown states through', () => {
		assert.equal(podmanBadgeStatus('failed'), 'failed');
		assert.equal(podmanBadgeStatus('Exited'), 'stopped');
		assert.equal(podmanBadgeStatus('Created'), 'starting');
		assert.equal(podmanBadgeStatus('unknown'), 'unknown');
	});
});

describe('podmanStateLabel', () => {
	it('title-cases states', () => {
		assert.equal(podmanStateLabel('not-found'), 'Not Found');
		assert.equal(podmanStateLabel('RUNNING'), 'Running');
		assert.equal(podmanStateLabel(''), 'Unknown');
	});
});

describe('podActions', () => {
	it('offers actions that fit the pod state', () => {
		assert.deepEqual(podActions('Running'), ['restart', 'stop', 'pause', 'kill']);
		assert.deepEqual(podActions('Paused'), ['unpause', 'stop', 'kill']);
		assert.deepEqual(podActions('Exited'), ['start']);
		assert.deepEqual(podActions('Degraded'), ['start', 'restart', 'stop', 'kill']);
	});

	it('treats running, paused and degraded pods as running for removal', () => {
		assert.equal(isRunningPod('Running'), true);
		assert.equal(isRunningPod('Degraded'), true);
		assert.equal(isRunningPod('Paused'), true);
		assert.equal(isRunningPod('Exited'), false);
		assert.equal(isRunningPod('Created'), true);
	});
});

describe('quadletActions', () => {
	it('offers start for stopped units and restart or stop for active ones', () => {
		assert.deepEqual(quadletActions('active'), ['restart', 'stop']);
		assert.deepEqual(quadletActions('inactive'), ['start']);
		assert.deepEqual(quadletActions('activating'), ['start', 'restart', 'stop']);
	});
});

describe('quadletFileNameError', () => {
	it('requires a known quadlet extension and no path', () => {
		assert.equal(quadletFileNameError(''), undefined);
		assert.equal(quadletFileNameError('web.container'), undefined);
		assert.equal(quadletFileNameError('stack.KUBE'), undefined);
		assert.equal(quadletFileNameError('etc/web.container'), 'Use a file name, not a path.');
		assert.match(quadletFileNameError('web.service') ?? '', /^End the name with/);
	});
});

describe('auto-update labels', () => {
	it('describes podman auto-update results', () => {
		assert.equal(autoUpdateUpdatedLabel('true'), 'Updated');
		assert.equal(autoUpdateUpdatedLabel('false'), 'Up to date');
		assert.equal(autoUpdateUpdatedLabel('pending'), 'Update available');
		assert.equal(autoUpdateUpdatedLabel('rolled back'), 'Rolled back');
		assert.equal(autoUpdateUpdatedStatus('failed'), 'failed');
		assert.equal(autoUpdateUpdatedStatus('pending'), 'starting');
		assert.equal(autoUpdateUpdatedStatus('false'), 'success');
		assert.equal(autoUpdateUpdatedStatus('other'), '');
	});
});

describe('memoryLimitLabel', () => {
	it('formats binary units and hides unlimited', () => {
		assert.equal(memoryLimitLabel(undefined), undefined);
		assert.equal(memoryLimitLabel(0), undefined);
		assert.equal(memoryLimitLabel(512 * 1024 * 1024), '512 MiB');
		assert.equal(memoryLimitLabel(1.5 * 1024 * 1024 * 1024), '1.5 GiB');
	});
});
