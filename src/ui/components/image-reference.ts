/**
 * Port of `ImageReferenceParts` (RowIcon.swift): splits "ghcr.io/org/app:1.2"
 * into "ghcr.io/org/", "app", and "1.2" so a row can lead with the image's own
 * name. Digest pins keep a short (12-char) digest as the tag.
 */
export type ImageReferenceParts = { namespace: string; name: string; tag?: string };

export function imageReferenceParts(reference: string): ImageReferenceParts {
	let path = reference;
	let tag: string | undefined;
	const at = path.lastIndexOf('@');
	if (at >= 0) {
		const digest = path.slice(at + 1);
		const pieces = digest.split(':');
		tag = (pieces[pieces.length - 1] ?? digest).slice(0, 12);
		path = path.slice(0, at);
	}
	const slash = path.lastIndexOf('/');
	const nameStart = slash >= 0 ? slash + 1 : 0;
	// A colon before the last slash is a registry port, not a tag.
	const colon = path.lastIndexOf(':');
	if (colon >= nameStart) {
		if (tag === undefined) tag = path.slice(colon + 1);
		path = path.slice(0, colon);
	}
	return {
		namespace: path.slice(0, nameStart),
		name: path.slice(nameStart),
		tag: tag ? tag : undefined
	};
}
