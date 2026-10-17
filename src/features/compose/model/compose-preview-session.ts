/**
 * Port of `ComposePreviewSession` (Types/ComposePreviewSession.swift): captures
 * the preference once, so an open editing session never switches beneath a draft.
 */
export const composePreviewPreferenceKey = 'arcane.preview.nativeComposeEditor';

export type ComposePreviewSession = { readonly isEnabled: boolean };

/** `ComposePreviewSession(defaults:)`; `read` is `UserDefaults.bool(forKey:)`. */
export function makeComposePreviewSession(
	read: (key: string) => boolean | undefined
): ComposePreviewSession {
	return { isEnabled: read(composePreviewPreferenceKey) ?? false };
}
