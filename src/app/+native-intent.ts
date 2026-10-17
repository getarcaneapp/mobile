/**
 * Keeps auth-session callbacks out of the router. On Android the OIDC and
 * passkey Custom Tab hands `arcane-mobile://…-callback` back to the app as a
 * deep link; `expo-web-browser` already resolves the pending session from it,
 * so navigating there would only show "Unmatched Route". (iOS consumes the
 * callback inside `ASWebAuthenticationSession` and never gets here with it.)
 */
const authCallback = /^arcane-mobile:\/\/\/?(?:oidc|passkey)-callback(?:[/?#]|$)/i;

export function redirectSystemPath({
	path,
	initial
}: {
	path: string;
	initial: boolean;
}): string | null {
	if (authCallback.test(path)) return initial ? '/' : null;
	return path;
}
