/**
 * Port of `DemoService.swift`: provisions a throwaway instance on the public
 * demo server, keeps it alive with a heartbeat while the app is active, and
 * ends it on sign-out or expiry.
 *
 * Swift stores the `session-id` cookie in `HTTPCookieStorage.shared`, which
 * every URLSession picks up. React Native has no API to write the cookie jar,
 * so the cookie travels as an explicit `Cookie` header instead (see
 * `DemoService.cookieHeader`, which the client manager adds to the client).
 */
import { AppState, type NativeEventSubscription } from 'react-native';

export const demoBaseURL = 'https://demo.getarcane.app';

export interface DemoSession {
	sessionID: string;
	/** Milliseconds since 1970. */
	endsAt: number;
	username: string;
	password: string;
}

export type DemoErrorKind = 'provisioningFailed' | 'decoding' | 'network';

export class DemoError extends Error {
	readonly kind: DemoErrorKind;

	constructor(kind: DemoErrorKind, underlying?: unknown) {
		super(DemoError.describe(kind, underlying));
		this.name = 'DemoError';
		this.kind = kind;
	}

	private static describe(kind: DemoErrorKind, underlying: unknown): string {
		switch (kind) {
			case 'provisioningFailed':
				return "The demo server couldn't spin up an instance. Try again in a moment.";
			case 'decoding':
				return 'The demo server returned an unexpected response.';
			case 'network': {
				const detail = underlying instanceof Error ? underlying.message : String(underlying);
				return `Couldn't reach the demo server: ${detail}`;
			}
		}
	}
}

async function post(
	path: string,
	timeoutMs: number,
	headers: Record<string, string> = {}
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(`${demoBaseURL}/${path}`, {
			method: 'POST',
			headers,
			signal: controller.signal
		});
	} catch (error) {
		// URLSession's wording for `timeoutInterval` expiring.
		if (controller.signal.aborted) throw new Error('The request timed out.');
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

function sessionCookie(header: string | null): string | undefined {
	return header?.match(/(?:^|[;,]\s*)session-id=([^;,\s]+)/)?.[1];
}

class DemoServiceImpl {
	private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	private appStateSubscription: NativeEventSubscription | undefined;
	private sessionID: string | undefined;

	/** The demo proxy routes every request to this session's instance by cookie. */
	get cookieHeader(): Record<string, string> | undefined {
		return this.sessionID ? { Cookie: `session-id=${this.sessionID}` } : undefined;
	}

	// MARK: - Provisioning

	async startInstance(): Promise<DemoSession> {
		let response: Response;
		try {
			response = await post('demo-kuma/start-instance', 90_000, { Accept: 'application/json' });
		} catch (error) {
			throw new DemoError('network', error);
		}
		if (response.status !== 200) throw new DemoError('provisioningFailed');

		let payload: {
			ok: boolean;
			sessionID?: string;
			endSessionTime: number;
			credentials: { username: string; password: string };
		};
		try {
			const raw = (await response.json()) as typeof payload;
			if (
				typeof raw.ok !== 'boolean' ||
				(raw.sessionID !== undefined && typeof raw.sessionID !== 'string') ||
				typeof raw.endSessionTime !== 'number' ||
				typeof raw.credentials?.username !== 'string' ||
				typeof raw.credentials?.password !== 'string'
			) {
				throw new Error('Unexpected payload');
			}
			payload = raw;
		} catch {
			throw new DemoError('decoding');
		}
		if (!payload.ok) throw new DemoError('provisioningFailed');

		// The current demo server sets the session cookie itself instead of
		// returning `sessionID`; the platform cookie jar then carries it.
		const sessionID = payload.sessionID ?? sessionCookie(response.headers.get('set-cookie'));
		this.sessionID = sessionID;
		return {
			sessionID: sessionID ?? '',
			endsAt: payload.endSessionTime,
			username: payload.credentials.username,
			password: payload.credentials.password
		};
	}

	// MARK: - Heartbeat

	startHeartbeat() {
		this.stopHeartbeat();
		this.scheduleHeartbeat();
		this.installLifecycleObservers();
	}

	stopHeartbeat() {
		if (this.heartbeatTimer !== undefined) clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = undefined;
		this.appStateSubscription?.remove();
		this.appStateSubscription = undefined;
	}

	private scheduleHeartbeat() {
		this.heartbeatTimer = setInterval(() => void this.sendHeartbeat(), 15_000);
	}

	private async sendHeartbeat() {
		try {
			await post('demo-kuma/heartbeat', 10_000, this.cookieHeader);
		} catch {
			// Best effort, like `try?` in Swift.
		}
	}

	// MARK: - End session

	async endSession() {
		this.stopHeartbeat();
		try {
			await post('demo-kuma/end-session', 10_000, this.cookieHeader);
		} catch {
			// Best effort.
		}
		this.sessionID = undefined;
	}

	// MARK: - Lifecycle (pause heartbeat in background)

	private installLifecycleObservers() {
		this.appStateSubscription?.remove();
		this.appStateSubscription = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				if (this.heartbeatTimer === undefined) {
					void this.sendHeartbeat();
					this.scheduleHeartbeat();
				}
			} else if (this.heartbeatTimer !== undefined) {
				clearInterval(this.heartbeatTimer);
				this.heartbeatTimer = undefined;
			}
		});
	}
}

export const DemoService = new DemoServiceImpl();
