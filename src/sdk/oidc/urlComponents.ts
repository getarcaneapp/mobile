/**
 * Minimal `URLComponents` for callback URLs (custom schemes included).
 * Unlike `parseURL` in client/url it keeps the distinction between an empty
 * and an absent path, query and fragment, which callback validation needs.
 * @internal
 */
import type { QueryItem } from '../client/url';

export interface CallbackURLComponents {
	/** As written (not lowercased). */
	scheme: string;
	user?: string;
	password?: string;
	host?: string;
	port?: number;
	/** Percent-encoded path; `""` when absent. */
	path: string;
	/** Percent-decoded items; `undefined` when the URL has no `?`. */
	queryItems?: QueryItem[];
	fragment?: string;
}

const PATTERN =
	/^([A-Za-z][A-Za-z0-9+.-]*):(?:\/\/(?:([^@/?#]*)@)?(\[[^\]]*\]|[^:/?#]*)(?::(\d*))?)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

function percentDecode(value: string): string {
	return decodeURIComponent(value);
}

/** Returns `undefined` for an unparseable URL or invalid percent escapes. */
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
