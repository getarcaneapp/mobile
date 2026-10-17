import type { QueryItem } from '../client/url';

export interface CallbackURLComponents {
	scheme: string;
	user?: string;
	password?: string;
	host?: string;
	port?: number;
	path: string;
	queryItems?: QueryItem[];
	fragment?: string;
}

const PATTERN =
	/^([A-Za-z][A-Za-z0-9+.-]*):(?:\/\/(?:([^@/?#]*)@)?(\[[^\]]*\]|[^:/?#]*)(?::(\d*))?)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

function percentDecode(value: string): string {
	return decodeURIComponent(value);
}

export function urlComponents(url: string): CallbackURLComponents | undefined {
	const match = PATTERN.exec(url);
	if (!match) return undefined;
	const [, scheme = '', userInfo, host, port, path = '', query, fragment] = match;
	try {
		let user: string | undefined;
		let password: string | undefined;
		if (userInfo !== undefined) {
			const colon = userInfo.indexOf(':');
			user = percentDecode(colon >= 0 ? userInfo.slice(0, colon) : userInfo);
			password = colon >= 0 ? percentDecode(userInfo.slice(colon + 1)) : undefined;
		}
		return {
			scheme,
			user,
			password,
			host: host === undefined ? undefined : percentDecode(host),
			port: port !== undefined && port !== '' ? Number(port) : undefined,
			path,
			queryItems:
				query === undefined
					? undefined
					: query === ''
						? []
						: query.split('&').map((pair) => {
								const equals = pair.indexOf('=');
								return equals < 0
									? { name: percentDecode(pair) }
									: {
											name: percentDecode(pair.slice(0, equals)),
											value: percentDecode(pair.slice(equals + 1))
										};
							}),
			fragment
		};
	} catch {
		return undefined;
	}
}
