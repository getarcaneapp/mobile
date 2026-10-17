/** Port of Models/Builds/BuildWorkspace.swift. */

/** Response body for `GET /environments/{id}/builds/browse/content`. */
export interface BuildFileContent {
	/** Base64-encoded file bytes. */
	content: string;
	mimeType: string;
}
