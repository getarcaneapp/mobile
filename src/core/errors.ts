/**
 * Port of `friendlyErrorMessage(_:)` (Models.swift) plus the transient-network
 * classification `ArcaneClientManager` uses to decide whether to rebuild its
 * session and retry. Pure TS (no RN imports).
 */
import {
	ArcaneConflictError,
	ArcaneError,
	ArcaneRateLimitedError,
	ArcaneServerError,
	ArcaneUnknownError,
	ArcaneValidationError,
	CancellationError,
	isAbortError
} from '@/sdk/errors/ArcaneError';

/**
 * React Native's `fetch` reports every connection-level failure as
 * `TypeError("Network request failed")`, which the SDK wraps in
 * `ArcaneError.transport`. It covers what URLSession splits into
 * cannot-connect / host-not-found / connection-lost.
 */
const rnNetworkFailure = 'network request failed';

/** True for Swift `CancellationError` equivalents (SDK, ResponseCache, aborts). */
export function isCancellation(error: unknown): boolean {
	if (error instanceof CancellationError || isAbortError(error)) return true;
	return error instanceof Error && error.name === 'CancellationError';
}

function cleanErrorText(message: string | undefined): string | undefined {
	if (message === undefined) return undefined;
	const trimmed = message.trim();
	if (!trimmed) return undefined;
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) return undefined;
	return trimmed;
}

function humanizeFieldName(name: string): string {
	const last = name.split('.').filter(Boolean).pop() ?? name;
	if (!last) return last;
	return last.charAt(0).toUpperCase() + last.slice(1);
}

/** Port of `friendlyErrorMessage(_:)`. */
export function friendlyErrorMessage(error: unknown): string {
	if (error instanceof ArcaneError) {
		switch (error.kind) {
			case 'proxyAuthenticationRequired':
				return 'Sign in to the proxy protecting this server';
			case 'authenticationRejected':
				return 'The server rejected authentication';
			case 'unauthorized':
				return 'Not signed in';
			case 'forbidden':
				return "You don't have permission to do that";
			case 'notFound':
				return 'Not found';
			case 'conflict':
				return cleanErrorText((error as ArcaneConflictError).conflictMessage) ?? 'Conflict';
			case 'validation': {
				const fields = (error as ArcaneValidationError).fields;
				const sorted = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
				const first = sorted[0];
				const firstMessage = first?.[1][0];
				if (!first || firstMessage === undefined) return 'Validation failed';
				const displayName = humanizeFieldName(first[0]);
				if (sorted.length <= 1) return `${displayName}: ${firstMessage}`;
				return `${sorted.length} fields need attention — ${displayName}: ${firstMessage}`;
			}
			case 'rateLimited': {
				const seconds = (error as ArcaneRateLimitedError).retryAfter;
				if (seconds !== undefined) return `Rate limited — retry in ${Math.trunc(seconds)}s`;
				return 'Rate limited — please wait';
			}
			case 'server':
				return cleanErrorText((error as ArcaneServerError).serverMessage) ?? 'Server error';
			case 'transport': {
				const message = error.message;
				const lower = message.toLowerCase();
				if (lower.includes('cancel')) return 'Cancelled';
				if (
					lower.includes('could not connect to the server') ||
					lower.includes('connection refused') ||
					lower.includes('cannot connect to host') ||
					lower.includes(rnNetworkFailure)
				) {
					return "Can't reach the server — check the address and that it's running.";
				}
				if (
					lower.includes('hostname could not be found') ||
					lower.includes('server with the specified hostname could not be found') ||
					lower.includes('cannot find host') ||
					lower.includes('could not find host') ||
					lower.includes('unable to resolve host') ||
					lower.includes('dns')
				) {
					return 'Server not found — check the address.';
				}
				if (lower.includes('timed out'))
					return 'Connection timed out — check the address and your network.';
				if (lower.includes('secure connection') || lower.includes('ssl')) {
					return "Secure connection failed — for a local server use http://, or check the server's certificate.";
				}
				if (lower.includes('app transport security') || lower.includes('cleartext')) {
					return 'Blocked an insecure connection — check the server URL.';
				}
				return `Connection error: ${message}`;
			}
			case 'decoding': {
				const message = error.message;
				// "Unexpected character '<'" = the server answered with an HTML page
				// (proxy login screen, wrong port, or a web app in front of Arcane).
				if (
					message.includes("Unexpected character '<'") ||
					message.toLowerCase().includes('not valid json') ||
					message.includes("Unexpected token '<'") ||
					message.includes('Unexpected token <')
				) {
					return 'The server replied with a webpage instead of the Arcane API. Check that the address points directly at your Arcane server (including the right port), with no login portal or other site in front of it.';
				}
				return `Response error: ${message}`;
			}
			case 'unknown':
				return `Something went wrong (${(error as ArcaneUnknownError).statusCode})`;
		}
	}
	if (isCancellation(error)) return 'Cancelled';
	if (error instanceof Error) return error.message;
	return String(error);
}

const transientPhrases = [
	'could not connect to the server',
	'connection refused',
	'network connection was lost',
	'timed out',
	'hostname could not be found',
	'server with the specified hostname could not be found',
	'cannot find host',
	'could not find host',
	'cannot connect to host',
	'no route to host',
	'network is unreachable',
	'network unreachable',
	'not connected to the internet',
	'internet connection appears to be offline',
	'offline',
	'dns',
	rnNetworkFailure,
	'unable to resolve host'
];

/** Port of `ArcaneClientManager.shouldRefreshNetworkSession(after:)`. */
export function shouldRefreshNetworkSession(error: unknown): boolean {
	if (!(error instanceof ArcaneError) || error.kind !== 'transport') {
		// RN surfaces raw TypeErrors when something bypasses the SDK.
		return error instanceof TypeError && error.message.toLowerCase().includes(rnNetworkFailure);
	}
	const lower = error.message.toLowerCase();
	return transientPhrases.some((phrase) => lower.includes(phrase));
}
