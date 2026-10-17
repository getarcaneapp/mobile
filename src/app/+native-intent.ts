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
