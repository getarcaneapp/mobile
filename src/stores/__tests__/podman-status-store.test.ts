import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'vite-plus/test';

import { PodmanStatus } from '../../sdk/models/podman/PodmanStatus';
import { usePodmanStatusStore } from '../podman-status-store';

const status = (detected: boolean, podCount = 0) =>
	PodmanStatus.decode({ detected, podCount, autoUpdateMode: 'rest' });

describe('usePodmanStatusStore', () => {
	beforeEach(() => usePodmanStatusStore.getState().reset());

	it('tracks detected environments', () => {
		const store = usePodmanStatusStore.getState();
		store.setStatus('1', status(true));
		store.setStatus('2', status(false));
		assert.deepEqual([...usePodmanStatusStore.getState().detectedEnvironmentIDs], ['1']);
		usePodmanStatusStore.getState().setStatus('1', undefined);
		assert.equal(usePodmanStatusStore.getState().detectedEnvironmentIDs.size, 0);
	});

	it('keeps the detected set identical when only counts change', () => {
		usePodmanStatusStore.getState().setStatus('1', status(true, 1));
		const before = usePodmanStatusStore.getState().detectedEnvironmentIDs;
		usePodmanStatusStore.getState().setStatus('1', status(true, 2));
		assert.equal(usePodmanStatusStore.getState().statuses['1']?.podCount, 2);
		assert.equal(usePodmanStatusStore.getState().detectedEnvironmentIDs, before);
	});

	it('skips identical updates', () => {
		usePodmanStatusStore.getState().setStatus('1', status(true, 1));
		const before = usePodmanStatusStore.getState().statuses;
		usePodmanStatusStore.getState().setStatus('1', status(true, 1));
		assert.equal(usePodmanStatusStore.getState().statuses, before);
	});
});
