import type { ISODateString } from '../base/date';
import type { ImageUpdateResponse } from '../imageUpdate/ImageUpdate';

export interface ImageUpdateInfo {
	hasUpdate: boolean;
	updateType: string;
	currentVersion: string;
	latestVersion: string;
	currentDigest: string;
	latestDigest: string;
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

	hasCheckResult(value: ImageUpdateInfo): boolean {
		return (
			value.hasUpdate ||
			value.error !== '' ||
			value.currentVersion !== '' ||
			value.currentDigest !== '' ||
			value.latestDigest !== ''
		);
	},

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
