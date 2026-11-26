export const AppLockGrace = {
	choices: [0, 60, 300, 900] as const,
	defaultValue: 0,
	title(seconds: number): string {
		if (seconds <= 0) return 'Immediately';
		const minutes = Math.round(seconds / 60);
		return minutes === 1 ? 'After 1 minute' : `After ${minutes} minutes`;
	},
	from(value: number | undefined): number {
		return value !== undefined && (AppLockGrace.choices as readonly number[]).includes(value)
			? value
			: AppLockGrace.defaultValue;
	}
};

export type BiometryKind =
	| 'faceID'
	| 'touchID'
	| 'opticID'
	| 'face'
	| 'fingerprint'
	| 'iris'
	| 'none';

export function biometryTitle(kind: BiometryKind, os: 'ios' | 'android'): string {
	switch (kind) {
		case 'faceID':
			return 'Face ID';
		case 'touchID':
			return 'Touch ID';
		case 'opticID':
			return 'Optic ID';
		case 'face':
			return 'Face Unlock';
		case 'fingerprint':
			return 'Fingerprint';
		case 'iris':
			return 'Iris';
		case 'none':
			return os === 'ios' ? 'Passcode' : 'Screen Lock';
	}
}

export function shouldLockOnResume(
	enabled: boolean,
	backgroundedAt: number | undefined,
	now: number,
	graceSeconds: number
): boolean {
	if (!enabled) return false;
	if (backgroundedAt === undefined) return false;
	return now - backgroundedAt >= graceSeconds * 1000;
}
