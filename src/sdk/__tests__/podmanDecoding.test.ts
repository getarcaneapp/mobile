import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { parseArcaneJSON } from '../http/json';
import { KubeDownReport, KubePlayReport } from '../models/podman/Kube';
import { Pod, PodInspect, PodTop } from '../models/podman/Pod';
import { PodmanAutoUpdateResult } from '../models/podman/PodmanAutoUpdate';
import { PodmanSecret } from '../models/podman/PodmanSecret';
import { PodmanStatus } from '../models/podman/PodmanStatus';
import {
	QuadletDetail,
	QuadletInstallReport,
	QuadletRemoveReport,
	QuadletType
} from '../models/podman/Quadlet';

const parse = (value: unknown) => parseArcaneJSON(JSON.stringify(value));

describe('PodmanStatus.decode', () => {
	it('defaults missing fields for undetected environments', () => {
		const status = PodmanStatus.decode(parse({ autoUpdateMode: 'unavailable' }));
		assert.equal(status.detected, false);
		assert.equal(status.podCount, 0);
		assert.equal(status.quadletsSupported, false);
		assert.equal(PodmanStatus.supportsAutoUpdate(status), false);
	});

	it('reads a detected rootless engine', () => {
		const status = PodmanStatus.decode(
			parse({
				detected: true,
				podCount: 3,
				version: '5.4.0',
				apiVersion: '5.4.0',
				rootless: true,
				quadletsSupported: true,
				quadletAppsSupported: false,
				autoUpdateMode: 'systemd',
				systemdAvailable: true,
				systemdScope: 'user',
				systemdReason: ''
			})
		);
		assert.equal(status.detected, true);
		assert.equal(status.podCount, 3);
		assert.equal(status.systemdScope, 'user');
		assert.equal(status.systemdReason, undefined);
		assert.equal(PodmanStatus.supportsAutoUpdate(status), true);
	});
});

describe('Pod.decode', () => {
	it('treats null containers as empty and keeps the environment tag', () => {
		const pod = Pod.decode(
			parse({
				id: 'abcdef1234567890',
				name: '',
				status: 'Running',
				created: '2026-01-02T03:04:05.123456789Z',
				containers: null,
				environmentId: 'env-1'
			})
		);
		assert.deepEqual(pod.containers, []);
		assert.equal(pod.environmentId, 'env-1');
		assert.equal(Pod.displayName(pod), 'abcdef123456');
	});

	it('decodes member containers', () => {
		const pod = Pod.decode(
			parse({
				id: 'p1',
				name: 'web',
				status: 'Degraded',
				created: '2026-01-02T03:04:05Z',
				containers: [{ id: 'c1', names: 'web-app', status: 'running', restartCount: 2 }]
			})
		);
		assert.equal(pod.containers[0]?.restartCount, 2);
		assert.equal(Pod.displayName(pod), 'web');
	});
});

describe('PodInspect.decode', () => {
	it('reads infra networks, sorts nothing and tolerates missing arrays', () => {
		const inspect = PodInspect.decode(
			parse({
				id: 'p1',
				name: 'web',
				created: '2026-01-02T03:04:05Z',
				state: 'Running',
				createCgroup: true,
				createInfra: true,
				infraContainerId: 'infra',
				infraConfig: { hostNetwork: false, networks: ['podman'] },
				numContainers: 2,
				containers: [
					{
						id: 'c1',
						name: 'app',
						state: 'running',
						created: '2026-01-02T03:04:05Z',
						exitCode: 0,
						isInfra: false
					},
					{
						id: 'infra',
						name: 'web-infra',
						state: 'running',
						created: '2026-01-02T03:04:05Z',
						exitCode: 0,
						isInfra: true
					}
				],
				memoryLimit: 0
			})
		);
		assert.deepEqual(inspect.networks, ['podman']);
		assert.deepEqual(inspect.sharedNamespaces, []);
		assert.equal(inspect.memoryLimit, undefined);
		assert.equal(inspect.containers.length, 2);
		assert.equal(inspect.containers[1]?.isInfra, true);
	});
});

describe('PodTop.decode', () => {
	it('handles null process tables', () => {
		assert.deepEqual(PodTop.decode(parse({ titles: null, processes: null })), {
			titles: [],
			processes: []
		});
		const top = PodTop.decode(parse({ titles: ['PID', 'CMD'], processes: [['1', 'sleep']] }));
		assert.deepEqual(top.processes, [['1', 'sleep']]);
	});
});

describe('QuadletDetail.decode', () => {
	it('falls back to the file extension for the type and prefers the unit state', () => {
		const quadlet = QuadletDetail.decode(
			parse({
				name: 'web.container',
				unitName: 'web.service',
				path: '/etc/containers/systemd/web.container',
				status: 'inactive',
				template: false,
				unitStatus: {
					name: 'web.service',
					loadState: 'loaded',
					activeState: 'active',
					subState: 'running'
				}
			})
		);
		assert.equal(quadlet.type, 'container');
		assert.equal(QuadletDetail.state(quadlet), 'active');
		assert.deepEqual(quadlet.containers, []);
	});

	it('uses the status without a unit', () => {
		const quadlet = QuadletDetail.decode(
			parse({ name: 'db.pod', status: 'Not loaded', type: 'pod', template: false })
		);
		assert.equal(QuadletDetail.state(quadlet), 'Not loaded');
	});
});

describe('QuadletType.fromFileName', () => {
	it('recognises known extensions only', () => {
		assert.equal(QuadletType.fromFileName('web.container'), 'container');
		assert.equal(QuadletType.fromFileName('app.KUBE'), 'kube');
		assert.equal(QuadletType.fromFileName('notes.txt'), undefined);
		assert.equal(QuadletType.fromFileName('.container'), undefined);
		assert.equal(QuadletType.fromFileName('web.'), undefined);
	});
});

describe('Quadlet reports', () => {
	it('surfaces the first install error', () => {
		const report = QuadletInstallReport.decode(
			parse({ installedQuadlets: null, quadletErrors: { 'web.container': 'invalid key' } })
		);
		assert.deepEqual(report.installedQuadlets, {});
		assert.equal(QuadletInstallReport.firstError(report), 'web.container: invalid key');
		assert.equal(
			QuadletInstallReport.firstError(
				QuadletInstallReport.decode(parse({ installedQuadlets: { a: '/a' }, quadletErrors: null }))
			),
			undefined
		);
	});

	it('defaults remove reports', () => {
		assert.deepEqual(QuadletRemoveReport.decode(parse({ removed: null, errors: null })), {
			removed: [],
			errors: {}
		});
	});
});

describe('Kube reports', () => {
	it('summarises play results', () => {
		const report = KubePlayReport.decode(
			parse({
				pods: [
					{
						id: '0123456789abcdef',
						containers: ['a', 'b'],
						initContainers: null,
						logs: null,
						containerErrors: ['b: image not found']
					}
				],
				volumes: [{ name: 'data' }, { name: '' }]
			})
		);
		assert.equal(KubePlayReport.hasErrors(report), true);
		assert.deepEqual(KubePlayReport.lines(report), [
			'Pod 0123456789ab: 2 containers',
			'b: image not found',
			'Volume data'
		]);
	});

	it('collects torn-down pod IDs', () => {
		const report = KubeDownReport.decode(
			parse({ stopReport: [{ id: 'a' }], rmReport: [{ id: 'a' }, { id: 'b' }] })
		);
		assert.deepEqual(report, { stopped: ['a'], removed: ['a', 'b'] });
		assert.deepEqual(KubeDownReport.decode(parse({ stopReport: null, rmReport: null })), {
			stopped: [],
			removed: []
		});
	});
});

describe('PodmanSecret.decode', () => {
	it('flattens the spec', () => {
		const secret = PodmanSecret.decode(
			parse({
				id: 'f00dfeedbeefcafe1234',
				createdAt: '2026-01-02T03:04:05Z',
				updatedAt: '2026-01-03T03:04:05Z',
				spec: { name: 'db_password', driver: { name: 'file' }, labels: { app: 'db' } }
			})
		);
		assert.equal(secret.name, 'db_password');
		assert.equal(secret.driver, 'file');
		assert.deepEqual(secret.labels, { app: 'db' });
	});

	it('falls back to the short ID and file driver', () => {
		const secret = PodmanSecret.decode(parse({ id: 'f00dfeedbeefcafe1234', spec: {} }));
		assert.equal(secret.name, 'f00dfeedbeef');
		assert.equal(secret.driver, 'file');
	});
});

describe('PodmanAutoUpdateResult.decode', () => {
	it('counts updated containers and defaults null arrays', () => {
		const result = PodmanAutoUpdateResult.decode(
			parse({
				mode: 'rest',
				reports: [
					{
						containerId: 'a',
						containerName: 'web',
						imageName: 'nginx',
						policy: 'registry',
						systemdUnit: 'web.service',
						updated: 'true'
					},
					{
						containerId: 'b',
						containerName: 'db',
						imageName: 'postgres',
						policy: 'registry',
						systemdUnit: 'db.service',
						updated: 'false'
					}
				],
				errors: null
			})
		);
		assert.equal(PodmanAutoUpdateResult.updatedCount(result), 1);
		assert.deepEqual(result.errors, []);
		const systemd = PodmanAutoUpdateResult.decode(
			parse({
				mode: 'systemd',
				reports: null,
				errors: null,
				unit: {
					name: 'podman-auto-update.service',
					loadState: 'loaded',
					activeState: 'activating',
					subState: 'start'
				}
			})
		);
		assert.equal(systemd.unit?.activeState, 'activating');
		assert.deepEqual(systemd.reports, []);
	});
});
