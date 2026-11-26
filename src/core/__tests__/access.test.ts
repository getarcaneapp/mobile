import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { canAccessTab, LoginCapabilities, type AccessContext } from '../auth/access';
import { ServerCapabilities } from '../../sdk/client/ServerCapabilities';
import { User } from '../../sdk/models/user/User';

const user = (overrides: Partial<User> = {}): User =>
	({ id: 'u', username: 'u', roles: [], ...overrides }) as User;

const context = (overrides: Partial<AccessContext>): AccessContext => ({
	currentUser: user(),
	serverCapabilities: ServerCapabilities.make(),
	permissionsManifest: undefined,
	activeEnvironmentID: '0',
	allEnvironmentsPreview: false,
	advancedFeatures: true,
	...overrides
});

describe('LoginCapabilities', () => {
	it('only an explicit false disables local auth', () => {
		assert.equal(LoginCapabilities.fromPublicSettings([]).localAuthEnabled, true);
		const caps = LoginCapabilities.fromPublicSettings([
			{ key: 'authLocalEnabled', value: ' FALSE ' },
			{ key: 'oidcEnabled', value: 'true' },
			{ key: 'oidcProviderName', value: 'Pocket ID' }
		] as never);
		assert.deepEqual(caps, {
			localAuthEnabled: false,
			oidcEnabled: true,
			oidcProviderName: 'Pocket ID',
			oidcProviderLogoURL: ''
		});
	});
});

describe('canAccessTab', () => {
	it('denies everything without a user', () => {
		assert.equal(canAccessTab('dashboard', context({ currentUser: undefined })), false);
	});
	it('without a manifest, admin tabs need admin', () => {
		assert.equal(canAccessTab('activities', context({})), true);
		assert.equal(canAccessTab('containers', context({})), true);
		assert.equal(canAccessTab('users', context({})), false);
		assert.equal(
			canAccessTab('users', context({ currentUser: user({ roles: ['admin'] } as never) })),
			true
		);
	});
	it("v2: uses the permissions manifest's access surfaces per environment", () => {
		const manifest = {
			resources: [],
			presets: [],
			accessSurfaces: [
				{
					id: 'route.containers',
					kind: 'route',
					label: 'Containers',
					accessMode: 'permissions',
					matchMode: 'any-of',
					scopeMode: 'selected-env-plus-global',
					permissions: ['containers:list'],
					children: []
				}
			]
		} as never;
		const v2User = user({ permissionsByEnv: { '1': ['containers:list'] } } as never);
		const base = context({
			currentUser: v2User,
			serverCapabilities: ServerCapabilities.make('rbac'),
			permissionsManifest: manifest
		});
		assert.equal(canAccessTab('containers', { ...base, activeEnvironmentID: '0' }), false);
		assert.equal(canAccessTab('containers', { ...base, activeEnvironmentID: '1' }), true);
		assert.equal(
			canAccessTab('containers', {
				...base,
				activeEnvironmentID: '0',
				allEnvironmentsPreview: true
			}),
			true
		);
		assert.equal(canAccessTab('dashboard', { ...base, activeEnvironmentID: '0' }), true);
	});
	it('hides branding, tunnel and diagnostics unless the server lists their surfaces', () => {
		const admin = user({ roles: ['admin'] } as never);
		for (const tab of ['branding', 'tunnel', 'diagnostics'] as const)
			assert.equal(canAccessTab(tab, context({ currentUser: admin })), false);

		const surface = (id: string, scopeMode: string, permission: string) => ({
			id,
			kind: 'settings-category',
			label: id,
			accessMode: 'permissions',
			matchMode: 'any-of',
			scopeMode,
			permissions: [permission],
			children: []
		});
		const manifest = {
			resources: [],
			presets: [],
			accessSurfaces: [
				surface('settings.category.branding', 'global-only', 'settings:update'),
				surface('settings.category.diagnostics', 'global-only', 'diagnostics:read'),
				surface('settings.category.tunnel', 'selected-env-plus-global', 'environment-settings:read')
			]
		} as never;
		const reader = user({
			permissionsByEnv: {
				[User.globalPermissionsKey]: ['diagnostics:read'],
				'1': ['environment-settings:read']
			}
		} as never);
		const base = context({
			currentUser: reader,
			serverCapabilities: ServerCapabilities.make('rbac'),
			permissionsManifest: manifest
		});
		assert.equal(canAccessTab('diagnostics', base), true);
		assert.equal(canAccessTab('branding', base), false);
		assert.equal(canAccessTab('tunnel', { ...base, activeEnvironmentID: '0' }), false);
		assert.equal(canAccessTab('tunnel', { ...base, activeEnvironmentID: '1' }), true);
		assert.equal(canAccessTab('tunnel', { ...base, advancedFeatures: false }), false);
	});
});

describe('canAccessTab podman', () => {
	const podmanUser = user({ permissionsByEnv: { '1': ['podman:read'] } } as never);
	const base = context({
		currentUser: podmanUser,
		activeEnvironmentID: '1',
		apiGeneration: 'v3',
		podmanEnvironmentIDs: new Set(['1'])
	});

	it('needs Arcane v3, a detected engine and podman:read on the active environment', () => {
		assert.equal(canAccessTab('podman', base), true);
		assert.equal(canAccessTab('podman', { ...base, apiGeneration: 'legacy' }), false);
		assert.equal(canAccessTab('podman', { ...base, podmanEnvironmentIDs: new Set() }), false);
		assert.equal(canAccessTab('podman', { ...base, podmanEnvironmentIDs: undefined }), false);
		assert.equal(
			canAccessTab('podman', {
				...base,
				activeEnvironmentID: '2',
				podmanEnvironmentIDs: new Set(['2'])
			}),
			false
		);
		assert.equal(
			canAccessTab('podman', { ...base, currentUser: user({ permissionsByEnv: {} } as never) }),
			false
		);
	});
});
