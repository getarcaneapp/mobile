import { describe, expect, it } from 'vite-plus/test';

import { AuthManager } from '../auth/AuthManager';
import { ArcaneTransport, decodePaginatedResponse } from '../client/ArcaneTransport';
import { EnvironmentID, RetryPolicy } from '../client/environment';
import { RESTService } from '../http/RESTService';
import { ContainersService } from '../services/ContainersService';
import { DashboardService } from '../services/DashboardService';
import { SettingsService } from '../services/SettingsService';
import { ItemEnvironment } from '../pagination/PaginatedResponse';
import { normalizeV3Environment, v3ResponseNormalizer } from '../client/v3Responses';
import { translateRouteForV3 } from '../client/v3Routes';
import { InMemoryTokenStore } from '../auth/TokenStore';
import { SessionBootstrap } from '../models/auth/SessionBootstrap';
import { EnvironmentChangesEvent } from '../models/event/EnvironmentChanges';
import { AccessSurface } from '../models/role/PermissionsManifest';
import { isoIn, mockFetch, type MockReply, type RecordedRequest } from './helpers';

const BASE = 'https://arcane.test';

function route(method: string, path: string, query: { name: string; value?: string }[] = []) {
	const translated = translateRouteForV3({ method, path, query });
	const search = translated.query.map((item) => `${item.name}=${item.value ?? ''}`).join('&');
	return `${translated.method} ${translated.path}${search ? `?${search}` : ''}`;
}

describe('translateRouteForV3', () => {
	it('turns legacy verb endpoints into action queries', () => {
		expect(route('POST', 'environments/0/containers/abc/restart')).toBe(
			'POST environments/0/containers/abc?action=restart'
		);
		expect(route('POST', 'environments/e1/projects/p1/up')).toBe(
			'POST environments/e1/projects/p1/deploy?action=up'
		);
		expect(
			route('POST', 'environments/e1/projects/p1/restart', [{ name: 'services', value: 'web' }])
		).toBe('POST environments/e1/projects/p1?action=restart&services=web');
		expect(route('POST', 'environments/0/system/containers/start-stopped')).toBe(
			'POST environments/0/system/containers?action=startstopped'
		);
		expect(route('POST', 'environments/0/volumes/data/backups/b1/restore-files')).toBe(
			'POST environments/0/volumes/data/backups/b1?action=restorefiles'
		);
		expect(route('POST', 'environments/0/image-updates/check-all')).toBe(
			'POST environments/0/images/updates/check?action=all'
		);
	});

	it('renames hyphenated resources and switches updates to PATCH', () => {
		expect(route('GET', 'api-keys')).toBe('GET apikeys');
		expect(route('PUT', 'api-keys/k1')).toBe('PATCH apikeys/k1');
		expect(route('GET', 'container-registries/pull-usage')).toBe('GET registries/usage');
		expect(route('PUT', 'environments/e1')).toBe('PATCH environments/e1');
		expect(route('PUT', 'environments/0/settings')).toBe('PATCH environments/0/settings');
		expect(route('GET', 'environments/0/job-schedules')).toBe('GET environments/0/jobs/schedules');
		expect(route('POST', 'environments/0/swarm/services/s1/scale')).toBe(
			'PATCH environments/0/swarm/services/s1'
		);
		expect(route('GET', 'app-version')).toBe('GET app/version');
	});

	it('moves notification settings out of the environment scope', () => {
		expect(route('GET', 'environments/e1/notifications/settings')).toBe(
			'GET notifications/settings'
		);
		expect(route('POST', 'environments/e1/notifications/test/discord')).toBe(
			'POST notifications/settings/discord?action=test'
		);
	});

	it('leaves unchanged routes alone', () => {
		expect(route('GET', 'environments/0/containers')).toBe('GET environments/0/containers');
		expect(route('PUT', 'environments/0/swarm/services/s1')).toBe(
			'PUT environments/0/swarm/services/s1'
		);
		expect(route('PUT', 'users/u1/role-assignments')).toBe('PUT users/u1/roles');
		expect(route('PUT', 'backups/recovery-key')).toBe('PUT backups/recovery/key');
	});
});

describe('v3 response normalizers', () => {
	it('flattens settings snapshots into the legacy list', () => {
		const normalize = v3ResponseNormalizer('GET', 'environments/0/settings');
		const settings = [{ key: 'oidcEnabled', value: 'true', type: 'bool', locked: true }];
		expect(normalize?.({ settings, runtime: {}, readOnly: false })).toEqual(settings);
		const envelope = v3ResponseNormalizer('PUT', 'environments/0/settings');
		expect(envelope?.({ settings, runtime: {}, readOnly: false })).toEqual({
			success: true,
			data: settings
		});
	});

	it('maps agent fields onto the edge model', () => {
		expect(
			normalizeV3Environment({
				id: 'e1',
				apiUrl: '',
				status: 'online',
				agentTransport: 'grpc',
				agentSecurityMode: 'mtls'
			})
		).toMatchObject({ isEdge: true, edgeTransport: 'grpc', edgeSecurityMode: 'mtls' });
		expect(normalizeV3Environment({ id: '0', apiUrl: '', status: 'online' })).toMatchObject({
			isEdge: false
		});
	});

	it('accepts the renamed environment scope mode', () => {
		const surface = AccessSurface.decode({
			id: 'route.dashboard',
			scopeMode: 'env-plus-global'
		});
		expect(surface.scopeMode).toBe('selected-env-plus-global');
	});
});

function makeClient(handler: (request: RecordedRequest) => MockReply) {
	const { fetch, requests } = mockFetch(handler);
	const tokenStore = new InMemoryTokenStore({
		accessToken: 'access',
		refreshToken: 'refresh',
		expiresAt: isoIn(3600)
	});
	const authManager = new AuthManager({ baseURL: BASE, tokenStore, fetch });
	const transport = new ArcaneTransport({
		baseURL: BASE,
		authManager,
		fetch,
		streamingFetch: fetch,
		retryPolicy: RetryPolicy.default
	});
	const rest = new RESTService(transport, EnvironmentID.localDocker);
	return {
		transport,
		containers: new ContainersService(rest),
		dashboard: new DashboardService(rest),
		settings: new SettingsService(rest),
		requests
	};
}

describe('API generation detection', () => {
	it('detects v3 and rewrites requests', async () => {
		const { requests, ...client } = makeClient((request) => {
			if (request.url.endsWith('/api/app/version'))
				return { status: 200, body: { currentVersion: '3.0.0', enabledFeatures: [] } };
			if (request.url.includes('/api/environments/0/settings'))
				return {
					status: 200,
					body: {
						settings: [{ key: 'a', value: '1', type: 'string' }],
						runtime: {},
						readOnly: false
					}
				};
			return { status: 200, body: { success: true, data: { message: 'ok' } } };
		});

		await client.containers.restart({ envID: '0', id: 'abc' });
		const settings = await client.settings.getSettings({ envID: '0' });

		expect(client.transport.currentAPIGeneration()).toBe('v3');
		expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			`GET ${BASE}/api/app/version`,
			`POST ${BASE}/api/environments/0/containers/abc?action=restart`,
			`GET ${BASE}/api/environments/0/settings`
		]);
		expect(settings).toEqual([{ key: 'a', value: '1', type: 'string' }]);
	});

	it('keeps legacy routes when the v3 probe is not found', async () => {
		const { requests, ...client } = makeClient((request) => {
			if (request.url.endsWith('/api/app/version'))
				return { status: 404, body: { title: 'Not Found', status: 404 } };
			return { status: 200, body: { success: true, data: { message: 'ok' } } };
		});

		await client.containers.restart({ envID: '0', id: 'abc' });

		expect(client.transport.currentAPIGeneration()).toBe('legacy');
		expect(requests[1]?.url).toBe(`${BASE}/api/environments/0/containers/abc/restart`);
	});
});

describe('v3 list totals', () => {
	it('requests exact totals from endpoints that skip counting by default', () => {
		expect(route('GET', 'environments/0/activities', [{ name: 'start', value: '0' }])).toBe(
			'GET environments/0/activities?start=0&includeTotal=true'
		);
		expect(route('GET', 'environments/a,b/activities')).toBe(
			'GET environments/a,b/activities?includeTotal=true'
		);
		expect(route('GET', 'events')).toBe('GET events?includeTotal=true');
		expect(route('GET', 'environments/0/containers')).toBe('GET environments/0/containers');
	});
});

describe('v3 change and bootstrap models', () => {
	it('decodes change revisions from the events stream channel', () => {
		const event = EnvironmentChangesEvent.decode({
			channel: 'events',
			eventLog: {
				type: 'changed',
				changes: [{ environmentId: 'e1', epoch: 'x', kinds: { container: 4, image: 2 } }]
			}
		});
		expect(event.changes).toEqual([
			{ environmentID: 'e1', epoch: 'x', kinds: { container: 4, image: 2 } }
		]);
		expect(EnvironmentChangesEvent.decode({ type: 'heartbeat' }).changes).toEqual([]);
	});

	it('decodes the session bootstrap with agent environments', () => {
		const bootstrap = SessionBootstrap.decode({
			user: {
				id: 'u1',
				username: 'admin',
				permissionsByEnv: { global: ['*'] },
				roleAssignments: [],
				isGlobalAdmin: true,
				canDelete: false,
				requiresPasswordChange: false
			},
			version: { currentVersion: '3.0.0', updateAvailable: false },
			environments: {
				success: true,
				data: [{ id: 'e1', apiUrl: '', status: 'online', agentTransport: 'grpc' }],
				pagination: { totalPages: 1, totalItems: 1, currentPage: 1, itemsPerPage: 20 }
			},
			permissionsManifest: { resources: [] }
		});
		expect(bootstrap.user.id).toBe('u1');
		expect(bootstrap.environments.data[0]).toMatchObject({ isEdge: true, edgeTransport: 'grpc' });
		expect(bootstrap.version.currentVersion).toBe('3.0.0');
	});
});

describe('multi-environment responses', () => {
	it('remembers the environment of each decoded row', () => {
		const response = decodePaginatedResponse(
			{
				success: true,
				data: [
					{ id: 'x', environmentId: 'a', environmentName: 'Alpha' },
					{ id: 'y', environmentId: 'b' }
				],
				pagination: { totalItems: 2, totalPages: 1, currentPage: 1, itemsPerPage: 50 },
				failedEnvironments: [
					{ environment: { id: 'c', name: 'c' }, message: 'Agent is not connected' }
				]
			},
			(raw) => ({ id: (raw as { id: string }).id })
		);
		expect(response.data).toEqual([{ id: 'x' }, { id: 'y' }]);
		expect(ItemEnvironment.get(response.data[0])).toEqual({ id: 'a', name: 'Alpha' });
		expect(ItemEnvironment.get(response.data[1])).toEqual({ id: 'b', name: undefined });
		expect(ItemEnvironment.get(ItemEnvironment.carry(response.data[0], { id: 'z' }))?.id).toBe('a');
		expect(response.failedEnvironments?.[0]?.environment.id).toBe('c');
	});

	it('builds dashboard snapshots for many environments from aggregated counts', async () => {
		const { requests, ...client } = makeClient((request) => {
			if (request.url.endsWith('/api/app/version'))
				return { status: 200, body: { currentVersion: '3.0.0', enabledFeatures: [] } };
			if (request.url.includes('/containers/counts'))
				return {
					status: 200,
					body: {
						success: true,
						data: { runningContainers: 3, stoppedContainers: 1, totalContainers: 4 },
						environments: [
							{
								environment: { id: 'a', name: 'Alpha' },
								data: { runningContainers: 3, stoppedContainers: 1, totalContainers: 4 }
							}
						],
						failedEnvironments: [
							{ environment: { id: 'b', name: 'b' }, message: 'Agent is not connected' }
						]
					}
				};
			return { status: 200, body: { success: true, data: {} } };
		});

		const { snapshots, failures } = await client.dashboard.snapshots({ envIDs: ['a', 'b'] });

		expect(snapshots.get('a')?.containers.counts.stoppedContainers).toBe(1);
		expect(snapshots.get('a')?.actionItems.items.map((item) => item.kind)).toEqual([
			'stopped_containers'
		]);
		expect(failures.get('b')).toBe('Agent is not connected');
		expect(requests.slice(1).map((request) => request.url.replace(BASE, ''))).toEqual(
			expect.arrayContaining([
				'/api/environments/a,b/containers/counts',
				'/api/environments/a,b/images/counts',
				'/api/environments/a,b/version'
			])
		);
		expect(requests).toHaveLength(6);
	});
});

describe('offline environments', () => {
	it('does not retry a remote environment the server reports as unavailable', async () => {
		const { requests, ...client } = makeClient((request) => {
			if (request.url.endsWith('/api/app/version')) return { status: 404, body: {} };
			return { status: 503, body: { error: 'Agent is not connected' } };
		});

		await expect(client.containers.statusCounts({ envID: 'remote' })).rejects.toThrow();
		expect(requests.filter((request) => request.url.includes('/remote/'))).toHaveLength(1);
		expect(client.transport.shouldRetry('GET', 503, 'environments/0/containers')).toBe(true);
		expect(client.transport.shouldRetry('GET', 503, 'environments/e1/containers')).toBe(false);
		expect(client.transport.shouldRetry('GET', 502, 'environments/e1/containers')).toBe(true);
	});
});
