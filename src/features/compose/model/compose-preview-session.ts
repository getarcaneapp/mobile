export const composePreviewPreferenceKey = 'arcane.preview.nativeComposeEditor';

export type ComposePreviewSession = { readonly isEnabled: boolean };

export function makeComposePreviewSession(
	read: (key: string) => boolean | undefined
): ComposePreviewSession {
	return { isEnabled: read(composePreviewPreferenceKey) ?? false };
}
