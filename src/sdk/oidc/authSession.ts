import { CancellationError } from '../errors/ArcaneError';

export type AuthSessionPresenter = (
	url: string,
	callbackScheme: string,
	signal: AbortSignal
) => Promise<string | undefined>;

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
