import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import type { AppTab } from '@/core/app-tab';

import {
	focusedTabGroup,
	planStackDestination,
	planTabSelection,
	sidebarGroups,
	sidebarSelection,
	type NavigationStateLike
} from '../large-screen-destinations';
import {
	contentPaneWidth,
	navigationLayoutFor,
	readableContentInset,
	sidebarWidthFor
} from '../navigation-layout';

function stack(key: string, names: string[]): NavigationStateLike {
	return {
		key,
		index: names.length - 1,
		routes: names.map((name, index) => ({ key: `${name}-${index}`, name }))
	};
}

function root(focused: string, stacks: Record<string, NavigationStateLike | undefined>) {
	const groups = Object.keys(stacks);
	return {
		key: 'root',
		index: 0,
		routes: [
			{
				key: 'tabs-route',
				name: '(tabs)',
				state: {
					key: 'tabs',
					index: groups.indexOf(focused),
					routes: groups.map((group) => ({
						key: `${group}-route`,
						name: group,
						state: stacks[group]
					}))
				}
			}
		]
	} satisfies NavigationStateLike;
}

describe('navigation layout', () => {
	it('uses a sidebar only on wide iPad windows', () => {
		assert.equal(navigationLayoutFor('ios', false, 932), 'tabBar');
		assert.equal(navigationLayoutFor('ios', true, 1194), 'sidebar');
		assert.equal(navigationLayoutFor('ios', true, 744), 'sidebar');
		assert.equal(navigationLayoutFor('ios', true, 683), 'tabBar');
		assert.equal(navigationLayoutFor('ios', true, 320), 'tabBar');
	});

	it('uses a rail on Android from the medium window size class', () => {
		assert.equal(navigationLayoutFor('android', false, 411), 'tabBar');
		assert.equal(navigationLayoutFor('android', false, 599), 'tabBar');
		assert.equal(navigationLayoutFor('android', false, 600), 'rail');
		assert.equal(navigationLayoutFor('android', false, 1280), 'rail');
	});

	it('constrains rail content to a readable width', () => {
		assert.equal(readableContentInset('tabBar', 1280), 0);
		assert.equal(readableContentInset('rail', 800), 0);
		assert.equal(readableContentInset('rail', 1280), 180);
		assert.equal(readableContentInset('sidebar', 1376), 0);
	});

	it('measures the pane beside the navigation chrome', () => {
		assert.equal(contentPaneWidth('tabBar', 390), 390);
		assert.equal(contentPaneWidth('rail', 1280), 1200);
		assert.equal(contentPaneWidth('sidebar', 1376), 1376 - sidebarWidthFor(1376));
	});
});

describe('sidebar destinations', () => {
	it('groups accessible destinations like the More screen', () => {
		const available = new Set<AppTab>(['dashboard', 'containers', 'updates', 'users']);
		assert.deepEqual(sidebarGroups(available), [
			{ title: 'Resources', tabs: ['dashboard', 'containers'] },
			{ title: 'Activity', tabs: ['updates'] },
			{ title: 'Users & Access', tabs: ['users'] }
		]);
	});

	it('selects the focused tab or the destination opened from More', () => {
		assert.equal(sidebarSelection(undefined), undefined);
		assert.equal(
			sidebarSelection(
				root('(containers)', { '(containers)': stack('c', ['containers', 'container/[id]']) })
			),
			'containers'
		);
		assert.equal(
			sidebarSelection(
				root('(more)', { '(more)': stack('m', ['more', 'users', 'settings/users/create']) })
			),
			'users'
		);
		assert.equal(
			sidebarSelection(root('(more)', { '(more)': stack('m', ['more', 'app-settings']) })),
			'app-settings'
		);
		assert.equal(sidebarSelection(root('(more)', { '(more)': stack('m', ['more']) })), undefined);
		assert.equal(
			focusedTabGroup(root('(more)', { '(dashboard)': undefined, '(more)': undefined })),
			'more'
		);
	});
});

describe('large screen navigation plans', () => {
	it('switches tabs without touching their stacks', () => {
		const state = root('(dashboard)', {
			'(dashboard)': stack('d', ['dashboard']),
			'(containers)': stack('c', ['containers', 'container/[id]'])
		});
		assert.deepEqual(planTabSelection(state, 'containers'), {
			actions: [{ type: 'JUMP_TO', payload: { name: '(containers)' }, target: 'tabs' }]
		});
	});

	it('pops the focused tab to its root', () => {
		const state = root('(containers)', {
			'(containers)': stack('c', ['containers', 'container/[id]'])
		});
		assert.deepEqual(planTabSelection(state, 'containers'), {
			actions: [{ type: 'POP_TO_TOP', target: 'c' }]
		});
		assert.deepEqual(
			planTabSelection(
				root('(containers)', { '(containers)': stack('c', ['containers']) }),
				'containers'
			),
			{ actions: [] }
		);
	});

	it('falls back to a link before the navigator is ready', () => {
		assert.deepEqual(planTabSelection(undefined, 'images'), {
			href: '/(tabs)/(images)/images'
		});
		assert.deepEqual(planStackDestination(undefined, 'users'), {
			href: '/(tabs)/(more)/users'
		});
	});

	it('pushes a destination onto the More root', () => {
		const state = root('(dashboard)', {
			'(dashboard)': stack('d', ['dashboard']),
			'(more)': stack('m', ['more'])
		});
		assert.deepEqual(planStackDestination(state, 'users'), {
			actions: [
				{ type: 'PUSH', payload: { name: 'users' }, target: 'm' },
				{ type: 'JUMP_TO', payload: { name: '(more)' }, target: 'tabs' }
			]
		});
	});

	it('replaces the open destination instead of stacking them', () => {
		const state = root('(more)', {
			'(more)': stack('m', ['more', 'users', 'settings/users/create'])
		});
		assert.deepEqual(planStackDestination(state, 'roles'), {
			actions: [
				{ type: 'POP_TO', payload: { name: 'roles', merge: true }, source: 'users-1', target: 'm' }
			]
		});
		assert.deepEqual(planStackDestination(state, 'users'), {
			actions: [
				{ type: 'POP_TO', payload: { name: 'users', merge: true }, source: 'users-1', target: 'm' }
			]
		});
		assert.deepEqual(
			planStackDestination(root('(more)', { '(more)': stack('m', ['more', 'users']) }), 'users'),
			{ actions: [] }
		);
	});
});
