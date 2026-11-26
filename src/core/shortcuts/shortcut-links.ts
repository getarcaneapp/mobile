export type ShortcutItemKind = 'container' | 'project';

export type ShortcutCatalogItem = {
	kind: ShortcutItemKind;
	id: string;
	name: string;
	environmentID: string;
	environmentName: string;
};

export type ShortcutCatalog = {
	schemaVersion: number;
	token: string;
	items: ShortcutCatalogItem[];
};

export const shortcutCatalogSchemaVersion = 1;
export const shortcutCatalogFileName = 'shortcut-catalog.json';

export const containerShortcutActions = ['start', 'stop', 'restart'] as const;
export const projectShortcutActions = ['up', 'redeploy', 'restart', 'down'] as const;
export type ContainerShortcutAction = (typeof containerShortcutActions)[number];
export type ProjectShortcutAction = (typeof projectShortcutActions)[number];

export type ShortcutLink =
	| { type: 'item'; kind: ShortcutItemKind; id: string; environmentID: string; name?: string }
	| {
			type: 'run';
			kind: 'container';
			action: ContainerShortcutAction;
			id: string;
			name: string;
			environmentID: string;
			token: string;
	  }
	| {
			type: 'run';
			kind: 'project';
			action: ProjectShortcutAction;
			id: string;
			name: string;
			environmentID: string;
			token: string;
	  };

const linkPattern = /^(?:arcane-mobile:\/\/\/?|\/)(item|run)\/?(?:\?([^#]*))?(?:#.*)?$/i;

function decoded(value: string): string | undefined {
	try {
		return decodeURIComponent(value.replace(/\+/g, ' '));
	} catch {
		return undefined;
	}
}

function queryParams(query: string): Map<string, string> {
	const params = new Map<string, string>();
	for (const pair of query.split('&')) {
		if (pair === '') continue;
		const equals = pair.indexOf('=');
		const name = decoded(equals < 0 ? pair : pair.slice(0, equals));
		const value = decoded(equals < 0 ? '' : pair.slice(equals + 1));
		if (name !== undefined && value !== undefined && !params.has(name))
			params.set(name, value.trim());
	}
	return params;
}

function includes<T extends string>(values: readonly T[], value: string | undefined): value is T {
	return value !== undefined && (values as readonly string[]).includes(value);
}

export function parseShortcutLink(path: string): ShortcutLink | undefined {
	const match = linkPattern.exec(path);
	if (!match) return undefined;
	const params = queryParams(match[2] ?? '');
	const kind = params.get('kind');
	const id = params.get('id');
	const environmentID = params.get('env');
	if ((kind !== 'container' && kind !== 'project') || !id || !environmentID) return undefined;
	const name = params.get('name') || undefined;
	if (match[1]?.toLowerCase() === 'item') return { type: 'item', kind, id, environmentID, name };
	const action = params.get('action');
	const token = params.get('token') ?? '';
	if (kind === 'container' && includes(containerShortcutActions, action))
		return { type: 'run', kind, action, id, name: name ?? id, environmentID, token };
	if (kind === 'project' && includes(projectShortcutActions, action))
		return { type: 'run', kind, action, id, name: name ?? id, environmentID, token };
	return undefined;
}

export function itemLink(
	item: Pick<ShortcutCatalogItem, 'kind' | 'id' | 'environmentID' | 'name'>
) {
	const query = [
		['kind', item.kind],
		['id', item.id],
		['env', item.environmentID],
		['name', item.name]
	]
		.map(([key, value]) => `${key}=${encodeURIComponent(value ?? '')}`)
		.join('&');
	return `arcane-mobile://item?${query}`;
}

export function itemRoute(
	link: { kind: ShortcutItemKind; id: string; environmentID: string; name?: string },
	group: string
): string {
	const segment = link.kind === 'container' ? 'container' : 'project';
	const query = [`envID=${encodeURIComponent(link.environmentID)}`];
	if (link.name) query.push(`name=${encodeURIComponent(link.name)}`);
	return `/(tabs)/${group}/${segment}/${encodeURIComponent(link.id)}?${query.join('&')}`;
}

export function spotlightItems(items: readonly ShortcutCatalogItem[]) {
	return items.map((item) => ({
		id: itemLink(item),
		title: item.name,
		subtitle: `${item.kind === 'container' ? 'Container' : 'Project'} · ${item.environmentName}`,
		kind: item.kind
	}));
}

export function catalogKey(items: readonly ShortcutCatalogItem[]): string {
	return items
		.map(
			(item) => `${item.kind}:${item.environmentID}:${item.id}:${item.name}:${item.environmentName}`
		)
		.join('|');
}
