export type PushPlatform = 'apns' | 'fcm';

export const androidPushChannelID = 'arcane';

export function pushPlatformFor(os: string): PushPlatform | undefined {
	if (os === 'ios') return 'apns';
	if (os === 'android') return 'fcm';
	return undefined;
}

export function installationRequestBody(
	platform: PushPlatform,
	deviceToken: string,
	apnsEnvironment: string,
	appVersion: string
): Record<string, string> {
	return platform === 'fcm'
		? { platform, deviceToken, appVersion }
		: { platform, apnsEnvironment, deviceToken, appVersion };
}

export function tokenUpdateBody(
	platform: PushPlatform,
	deviceToken: string,
	apnsEnvironment: string
): Record<string, string> {
	return platform === 'fcm' ? { deviceToken } : { deviceToken, apnsEnvironment };
}

export function isUnsupportedPlatformError(status: number, message: string): boolean {
	return status === 400 && /^platform ".*" is not supported$/.test(message);
}
