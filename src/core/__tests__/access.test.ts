import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import { canAccessTab, LoginCapabilities, type AccessContext } from '../auth/access';
import { ServerCapabilities } from '../../sdk/client/ServerCapabilities';
import type { User } from '../../sdk/models/user/User';

const user = (overrides: Partial<User> = {}): User =>
	({ id: 'u', username: 'u', roles: [], ...overrides }) as User;

const context = (overrides: Partial<AccessContext>): AccessContext => ({
	currentUser: user(),
	serverCapabilities: ServerCapabilities.make('legacyRoles'),
	permissionsManifest: undefined,
	activeEnvironmentID: '0',
	allEnvironmentsPreview: false,
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
	it('v1: v2-only tabs are hidden, admin tabs need admin', () => {
		assert.equal(canAccessTab('activities', context({})), false);
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
	});
});
