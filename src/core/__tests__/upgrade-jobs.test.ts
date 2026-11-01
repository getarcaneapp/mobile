import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	defaultSelection,
	failedEnvironmentIDs,
	isNewerUpgradeJob,
	resultLogs,
	selectionRequest,
	type UpdateCandidate
} from '../../features/environments/upgrade-job-follow';
import {
	upgradeResultDetail,
	upgradeResultLabel
} from '../../features/environments/upgrade-job-display';
import {
	EnvironmentUpdateJob,
	UpgradeJobStreamEvent,
	type EnvironmentUpdateResult
} from '../../sdk/models/system/Upgrade';

const candidate = (overrides: Partial<UpdateCandidate> & { id: string }): UpdateCandidate => ({
	name: overrides.id,
	isManager: overrides.id === '0',
	online: true,
	updateAvailable: undefined,
	version: undefined,
	...overrides
});

const job = (overrides: Partial<EnvironmentUpdateJob> = {}): EnvironmentUpdateJob => ({
	id: 'job',
	status: 'running',
	updatedAt: '2026-11-01T10:00:00Z',
	...overrides
});

const result = (overrides: Partial<EnvironmentUpdateResult>): EnvironmentUpdateResult => ({
	environmentId: '1',
	environmentName: 'Edge',
	status: 'pending',
	...overrides
});

describe('upgrade job selection', () => {
	it('defaults to online environments with updates, else every online environment', () => {
		const candidates = [
			candidate({ id: '0', updateAvailable: true }),
			candidate({ id: '1', updateAvailable: false }),
			candidate({ id: '2', updateAvailable: true, online: false })
		];
		assert.deepEqual(defaultSelection(candidates), ['0']);
		assert.deepEqual(
			defaultSelection(candidates.map((c) => ({ ...c, updateAvailable: undefined }))),
			['0', '1']
		);
	});
	it('omits the environment list when everything is selected', () => {
		const candidates = [candidate({ id: '0' }), candidate({ id: '1' })];
		assert.equal(selectionRequest(candidates, ['1', '0']), undefined);
		assert.deepEqual(selectionRequest(candidates, ['1', 'gone']), ['1']);
	});
	it('collects failed environments for a retry', () => {
		const failed = job({
			status: 'completed',
			results: [
				result({ environmentId: '0', status: 'updated' }),
				result({ environmentId: '1', status: 'failed' })
			]
		});
		assert.deepEqual(failedEnvironmentIDs(failed), ['1']);
	});
});

describe('upgrade job following', () => {
	it('ignores other jobs, stale snapshots, and regressions from terminal', () => {
		const current = job();
		assert.equal(isNewerUpgradeJob(job({ id: 'other' }), current), false);
		assert.equal(isNewerUpgradeJob(job({ updatedAt: '2026-11-01T09:59:00Z' }), current), false);
		assert.equal(isNewerUpgradeJob(job({ updatedAt: '2026-11-01T10:00:05Z' }), current), true);
		assert.equal(
			isNewerUpgradeJob(job({ updatedAt: '2026-11-01T10:01:00Z' }), job({ status: 'completed' })),
			false
		);
	});
	it('decodes the arcane-upgrade stream envelope', () => {
		const event = UpgradeJobStreamEvent.decode({
			channel: 'arcane-upgrade',
			upgrade: {
				id: 'job',
				status: 'running',
				results: [
					{
						environmentId: '1',
						environmentName: 'Edge',
						status: 'updating',
						stage: 'pulling',
						percent: 40,
						logs: ['Pulling image']
					}
				]
			}
		});
		assert.equal(event.job?.results?.[0]?.logs?.[0], 'Pulling image');
		assert.deepEqual(UpgradeJobStreamEvent.decode({ channel: 'events', eventLog: {} }), {});
	});
	it('keeps only the newest log lines', () => {
		assert.equal(resultLogs(['a', 'b', 'c'], 2), 'b\nc');
		assert.equal(resultLogs(undefined), '');
	});
});

describe('upgrade job display', () => {
	it('labels stages and versions', () => {
		assert.equal(
			upgradeResultLabel(result({ status: 'updating', stage: 'pulling' })),
			'Pulling image'
		);
		assert.equal(
			upgradeResultLabel(result({ environmentId: '0', status: 'updating', stage: 'reconnecting' })),
			'Manager restarting'
		);
		assert.equal(
			upgradeResultDetail(result({ fromVersion: 'v2.0', toVersion: 'v3.0' })),
			'v2.0 → v3.0'
		);
		assert.equal(upgradeResultDetail(result({ status: 'failed', error: 'boom' })), 'boom');
	});
});
