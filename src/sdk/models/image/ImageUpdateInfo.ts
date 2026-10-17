/** Port of Models/Image/ImageUpdateInfo.swift. */
import type { ISODateString } from '../base/date';
import type { ImageUpdateResponse } from '../imageUpdate/ImageUpdate';

/** Image update availability info attached to image and container summaries. */
export interface ImageUpdateInfo {
	hasUpdate: boolean;
	updateType: string;
	currentVersion: string;
	latestVersion: string;
	currentDigest: string;
	latestDigest: string;
	/** Optional so responses from servers that omit the timestamp still decode. */
	checkTime?: ISODateString;
	responseTimeMs: number;
	error: string;
	authMethod?: string;
	authUsername?: string;
	authRegistry?: string;
	usedCredential?: boolean;
}

export const ImageUpdateInfo = {
	make(init: Partial<ImageUpdateInfo> = {}): ImageUpdateInfo {
		return {
			...init,
			hasUpdate: init.hasUpdate ?? false,
			updateType: init.updateType ?? '',
			currentVersion: init.currentVersion ?? '',
			latestVersion: init.latestVersion ?? '',
			currentDigest: init.currentDigest ?? '',
			latestDigest: init.latestDigest ?? '',
			responseTimeMs: init.responseTimeMs ?? 0,
			error: init.error ?? ''
		};
	},

	/**
	 * True when this inline info carries an actual check result — not just
	 * struct zero-values. Servers attach a default-initialized `updateInfo`
	 * to images that simply haven't been scanned yet; use this to avoid
	 * treating those as "up to date".
	 */
	hasCheckResult(value: ImageUpdateInfo): boolean {
		return (
			value.hasUpdate ||
			value.error !== '' ||
			value.currentVersion !== '' ||
			value.currentDigest !== '' ||
			value.latestDigest !== ''
		);
	},

	/**
	 * Bridges the inline/persisted info shape into the check-endpoint
	 * response shape (`ImageUpdateResponse`) so clients can consume a single
	 * model regardless of which endpoint produced the data.
	 */
	asUpdateResponse(value: ImageUpdateInfo): ImageUpdateResponse {
		return {
			hasUpdate: value.hasUpdate,
			updateType: value.updateType,
			currentVersion: value.currentVersion,
			latestVersion: value.latestVersion === '' ? undefined : value.latestVersion,
			currentDigest: value.currentDigest === '' ? undefined : value.currentDigest,
			latestDigest: value.latestDigest === '' ? undefined : value.latestDigest,
			checkTime: value.checkTime,
			responseTimeMs: value.responseTimeMs,
			error: value.error === '' ? undefined : value.error,
			authMethod: value.authMethod,
			authUsername: value.authUsername,
			authRegistry: value.authRegistry,
			usedCredential: value.usedCredential
		};
	}
} as const;
