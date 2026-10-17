/**
 * Replacement for `ASWebAuthenticationSession`: the app presents the browser
 * (e.g. `expo-web-browser`'s `openAuthSessionAsync(url, redirectUrl)`) and
 * the SDK drives the protocol around it.
 */
import { CancellationError } from '../errors/ArcaneError';

/**
 * Presents `url` in a secure (ideally ephemeral) browser session and resolves
 * with the callback URL once the browser navigates to `callbackScheme://…`.
 *
 * - Resolve `undefined` if the session finished without a callback URL.
 * - Reject if the user dismissed the browser (e.g. with `CancellationError`)
 *   or the session could not start (`SignInError.sessionDidNotStart()` /
 *   `CeremonyError.sessionDidNotStart()`).
 * - Stop the session when `signal` aborts.
 */
export type AuthSessionPresenter = (
	url: string,
	callbackScheme: string,
	signal: AbortSignal
) => Promise<string | undefined>;

/**
 * Port of Swift `awaitCallback(stream:start:cancel:)`: never starts once
 * cancelled, cancels a started session when `signal` aborts (rejecting with
 * `CancellationError`), and maps a missing callback to `missingCallback()`.
 * @internal
 */
export async function awaitAuthSession(
	present: (signal: AbortSignal) => Promise<string | undefined>,
	options: { signal?: AbortSignal; missingCallback: () => Error }
): Promise<string> {
	const { signal, missingCallback } = options;
	if (signal?.aborted) throw new CancellationError();

	const session = new AbortController();
	let onAbort: (() => void) | undefined;
	const aborted = new Promise<never>((_, reject) => {
		onAbort = () => {
			session.abort();
			reject(new CancellationError());
		};
		signal?.addEventListener('abort', onAbort);
	});
	// Keep an unobserved rejection from surfacing when the session wins the race.
	aborted.catch(() => {});

	try {
		const callbackURL = await Promise.race([present(session.signal), aborted]);
		if (signal?.aborted) throw new CancellationError();
		if (callbackURL === undefined) throw missingCallback();
		return callbackURL;
	} catch (error) {
		if (!signal?.aborted) throw error;
		session.abort();
		throw new CancellationError();
	} finally {
		if (onAbort) signal?.removeEventListener('abort', onAbort);
	}
}
