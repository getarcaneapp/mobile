import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { parseWidgetLink, tabHref } from '@/core/widgets/widget-links';
import {
	buildWidgetEnvironments,
	materialWidgetKey,
	signedOutWidgetSnapshot,
	widgetDate,
	type WidgetEnvironmentSources,
	type WidgetEnvironmentSummary
} from '@/core/widgets/widget-snapshot';
import type { ActionItems, DashboardSnapshot } from '@/sdk/models/dashboard';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';
import type { DashboardStates } from '@/stores/dashboard-stream-logic';

const items = (updates: number, vulnerabilities: number): ActionItems => ({
	items: [
		{ kind: 'image_updates', count: updates, severity: 'warning' },
		{ kind: 'actionable_vulnerabilities', count: vulnerabilities, severity: 'critical' }
	]
});

const snapshot = (running: number, total: number, images: number, actions: ActionItems) =>
	({
		containers: {
			data: [],
			counts: {
				runningContainers: running,
				stoppedContainers: total - running,
				totalContainers: total
			},
			pagination: {}
		},
		images: { data: [], pagination: {} },
		imageUsageCounts: { totalImages: images },
		actionItems: actions,
		settings: {}
	}) as unknown as DashboardSnapshot;

const docker = (running: number, total: number, images: number) =>
	({
		info: {
			ContainersRunning: running,
			Containers: total,
			ContainersStopped: total - running,
			Images: images
		}
	}) as unknown as DockerInfo;

const sources = (overrides: Partial<WidgetEnvironmentSources>): WidgetEnvironmentSources => ({
	environments: [],
	dashboardStates: {},
	dockerInfo: {},
	unavailableEnvironmentIDs: new Set(),
	actionItems: () => undefined,
	previous: [],
	...overrides
});

describe('widget snapshot', () => {
	it('prefers dashboard stream counts and action items', () => {
		const states: DashboardStates = {
			'0': {
				id: '0',
				name: 'Local',
				hasLoaded: true,
				loading: false,
				streamError: false,
				snapshot: snapshot(3, 5, 9, items(2, 4))
			}
		};
		const result = buildWidgetEnvironments(
			sources({
				environments: [{ id: '0', name: ' Local ' }],
				dashboardStates: states,
				dockerInfo: { '0': docker(1, 1, 1) }
			})
		);
		assert.deepEqual(result, [
			{
				id: '0',
				name: 'Local',
				online: true,
				running: 3,
				stopped: 2,
				total: 5,
				images: 9,
				updatesAvailable: 2,
				actionableVulnerabilities: 4
			}
		]);
	});

	it('falls back to Docker info and marks unavailable environments offline', () => {
		const previous: WidgetEnvironmentSummary[] = [
			{
				id: '1',
				name: 'Edge',
				online: true,
				running: 4,
				stopped: 0,
				total: 4,
				images: 2,
				updatesAvailable: 6,
				actionableVulnerabilities: 1
			}
		];
		const result = buildWidgetEnvironments(
			sources({
				environments: [
					{ id: '0', name: '' },
					{ id: '1', name: 'Edge' }
				],
				dockerInfo: { '0': docker(2, 3, 7) },
				unavailableEnvironmentIDs: new Set(['1']),
				actionItems: (id) => (id === '0' ? items(1, 0) : undefined),
				previous
			})
		);
		assert.equal(result?.[0]?.name, '0');
		assert.equal(result?.[0]?.running, 2);
		assert.equal(result?.[0]?.updatesAvailable, 1);
		assert.deepEqual(result?.[1], {
			id: '1',
			name: 'Edge',
			online: false,
			running: 0,
			stopped: 0,
			total: 0,
			images: 0,
			updatesAvailable: 6,
			actionableVulnerabilities: 1
		});
	});

	it('waits until every environment has data unless a previous value exists', () => {
		const environments = [{ id: '0', name: 'Local' }];
		assert.equal(buildWidgetEnvironments(sources({ environments })), undefined);
		const previous: WidgetEnvironmentSummary[] = [
			{
				id: '0',
				name: 'Old',
				online: true,
				running: 1,
				stopped: 0,
				total: 1,
				images: 1,
				updatesAvailable: 0
			}
		];
		assert.equal(buildWidgetEnvironments(sources({ environments, previous }))?.[0]?.name, 'Local');
	});

	it('caps environments and bounds counts', () => {
		const environments = Array.from({ length: 14 }, (_, index) => ({
			id: String(index),
			name: `Env ${index}`
		}));
		const dockerInfo = Object.fromEntries(
			environments.map((environment) => [environment.id, docker(-5, 2e12, Number.NaN)])
		);
		const result = buildWidgetEnvironments(sources({ environments, dockerInfo }));
		assert.equal(result?.length, 10);
		assert.equal(result?.[0]?.running, 0);
		assert.equal(result?.[0]?.total, 1_000_000_000);
		assert.equal(result?.[0]?.images, 0);
	});

	it('writes dates Swift can decode and ignores the timestamp for change detection', () => {
		assert.equal(widgetDate(new Date(Date.UTC(2026, 9, 20, 8, 5, 3, 456))), '2026-10-20T08:05:03Z');
		const first = signedOutWidgetSnapshot(new Date(0));
		const second = signedOutWidgetSnapshot(new Date(60_000));
		assert.notEqual(first.generatedAt, second.generatedAt);
		assert.equal(materialWidgetKey(first), materialWidgetKey(second));
	});
});

describe('widget links', () => {
	it('parses tabs, environments and names', () => {
		assert.deepEqual(parseWidgetLink('arcane-mobile://open?tab=containers&env=a%20b&name=My+Env'), {
			tab: 'containers',
			environmentID: 'a b',
			environmentName: 'My Env'
		});
		assert.deepEqual(parseWidgetLink('/open?tab=updates'), {
			tab: 'updates',
			environmentID: undefined,
			environmentName: undefined
		});
		assert.equal(parseWidgetLink('arcane-mobile://open?tab=nope')?.tab, 'dashboard');
		assert.equal(parseWidgetLink('arcane-mobile://opener?tab=updates'), undefined);
		assert.equal(parseWidgetLink('arcane-mobile://passkey-callback?state=x'), undefined);
	});

	it('routes to the tab stack when pinned and through More otherwise', () => {
		assert.equal(
			tabHref('containers', ['dashboard', 'containers']),
			'/(tabs)/(containers)/containers'
		);
		assert.equal(tabHref('updates', ['dashboard']), '/(tabs)/(more)/updates');
		assert.equal(tabHref('settings', []), '/(tabs)/(more)/more');
	});
});
