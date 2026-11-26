import assert from 'node:assert/strict';
import { describe, it } from 'vite-plus/test';

import {
	itemLink,
	itemRoute,
	parseShortcutLink,
	spotlightItems
} from '../shortcuts/shortcut-links';

describe('parseShortcutLink', () => {
	it('parses item links in URL and path form', () => {
		assert.deepEqual(parseShortcutLink('arcane-mobile://item?kind=container&id=web&env=0'), {
			type: 'item',
			kind: 'container',
			id: 'web',
			environmentID: '0',
			name: undefined
		});
		assert.equal(parseShortcutLink('/item?kind=project&id=p1&env=2&name=Blog')?.type, 'item');
	});

	it('parses run links and rejects unknown actions or kinds', () => {
		const link = parseShortcutLink(
			'arcane-mobile://run?kind=project&action=redeploy&id=p1&name=My%20Blog&env=2&token=abc'
		);
		assert.deepEqual(link, {
			type: 'run',
			kind: 'project',
			action: 'redeploy',
			id: 'p1',
			name: 'My Blog',
			environmentID: '2',
			token: 'abc'
		});
		assert.equal(
			parseShortcutLink('arcane-mobile://run?kind=container&action=up&id=web&env=0'),
			undefined
		);
		assert.equal(
			parseShortcutLink('arcane-mobile://run?kind=image&action=stop&id=x&env=0'),
			undefined
		);
		assert.equal(parseShortcutLink('arcane-mobile://item?kind=container&env=0'), undefined);
		assert.equal(parseShortcutLink('arcane-mobile://open?tab=containers'), undefined);
	});
});

describe('item links and routes', () => {
	const item = {
		kind: 'container' as const,
		id: 'my web',
		name: 'my web',
		environmentID: '0',
		environmentName: 'Local'
	};

	it('round-trips item links', () => {
		const link = parseShortcutLink(itemLink(item));
		assert.equal(link?.type, 'item');
		assert.equal(link?.id, 'my web');
	});

	it('builds detail routes in the given tab group', () => {
		assert.equal(
			itemRoute({ kind: 'project', id: 'p1', environmentID: '2', name: 'Blog' }, '(projects)'),
			'/(tabs)/(projects)/project/p1?envID=2&name=Blog'
		);
		assert.equal(
			itemRoute({ kind: 'container', id: 'my web', environmentID: '0' }, '(more)'),
			'/(tabs)/(more)/container/my%20web?envID=0'
		);
	});

	it('describes Spotlight items', () => {
		assert.equal(spotlightItems([item])[0]?.subtitle, 'Container · Local');
	});
});
