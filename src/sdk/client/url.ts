export interface QueryItem {
	name: string;
	value?: string;
}

export function q(name: string, value: string | number | boolean | undefined): QueryItem {
	return value === undefined ? { name } : { name, value: String(value) };
}

export function boolString(value: boolean): string {
	return value ? 'true' : 'false';
}

function trimSlashes(path: string): string {
	return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

function encodePathSegment(segment: string): string {
	return segment
		.split('/')
		.map((part) =>
			encodeURIComponent(part).replace(/%(3A|40|21|24|26|27|28|29|2A|2B|2C|3B|3D)/gi, (match) =>
				decodeURIComponent(match)
			)
		)
		.join('/');
}

export interface ParsedURL {
	scheme: string;
	user?: string;
	password?: string;
	host: string;
	port?: number;
	path: string;
	query?: string;
	fragment?: string;
}

const URL_PATTERN =
	/^([A-Za-z][A-Za-z0-9+.-]*):\/\/(?:([^@/?#]*)@)?(\[[^\]]*\]|[^:/?#]*)(?::(\d*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

export function parseURL(url: string): ParsedURL | undefined {
	const match = URL_PATTERN.exec(url.trim());
	if (!match) return undefined;
	const [, scheme = '', userInfo, host = '', port, path, query, fragment] = match;
	let user: string | undefined;
	let password: string | undefined;
	if (userInfo !== undefined) {
		const colon = userInfo.indexOf(':');
		user = colon >= 0 ? userInfo.slice(0, colon) : userInfo;
		password = colon >= 0 ? userInfo.slice(colon + 1) : undefined;
	}
	return {
		scheme: scheme.toLowerCase(),
		user,
		password,
		host,
		port: port !== undefined && port !== '' ? Number(port) : undefined,
		path: path === undefined || path === '' ? '/' : path,
		query,
		fragment
	};
}

export function appendingAPIPath(baseURL: string, path: string): string {
	const cut = baseURL.search(/[?#]/);
	const base = cut >= 0 ? baseURL.slice(0, cut) : baseURL;
	const normalizedBase = base.endsWith('/') ? base : `${base}/`;
	const trimmed = encodePathSegment(trimSlashes(path));
	const parsed = parseURL(normalizedBase);
	const basePath = parsed?.path ?? '/';
	if (basePath.endsWith('/api/')) return `${normalizedBase}${trimmed}`;
	return `${normalizedBase}api/${trimmed}`;
}

export function withQueryItems(url: string, items: readonly QueryItem[]): string {
	if (items.length === 0) return url;
	const encode = (value: string) =>
		encodeURIComponent(value).replace(/%(3A|2F|40|2C|24|21|27|28|29|2A|3B|3F)/gi, (m) =>
			decodeURIComponent(m)
		);
	const hashIndex = url.indexOf('#');
	const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
	const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
	const query = items
		.map((item) =>
			item.value === undefined ? encode(item.name) : `${encode(item.name)}=${encode(item.value)}`
		)
		.join('&');
	const separator = base.includes('?')
		? base.endsWith('?') || base.endsWith('&')
			? ''
			: '&'
		: '?';
	return `${base}${separator}${query}${hash}`;
}

export function webSocketURL(url: string): string {
	if (url.startsWith('https:')) return `wss:${url.slice('https:'.length)}`;
	if (url.startsWith('http:')) return `ws:${url.slice('http:'.length)}`;
	return url;
}
