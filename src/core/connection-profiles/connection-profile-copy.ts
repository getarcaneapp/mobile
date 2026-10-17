import { Platform } from 'react-native';

const ios = Platform.OS === 'ios';

export const ConnectionProfileCopy = {
	emptyDescription: ios
		? 'Add a server once, then choose it quickly on any device using your iCloud account.'
		: 'Add a server once, then choose it quickly next time.',
	listFooter: ios
		? 'Profiles can include a password sign-in. Profiles and sign-ins sync through iCloud Keychain; sessions stay on each device.'
		: 'Profiles can include a password sign-in. With a screen lock set, profiles back up to your Google account; sign-ins can be saved to Google Password Manager. Sessions stay on each device.',
	credentialBadge: ios ? 'Sign-in synced with iCloud' : 'Sign-in saved',
	serverURLFooter: ios
		? 'HTTP or HTTPS only. URL credentials, query parameters, and fragments are removed before iCloud sync.'
		: 'HTTP or HTTPS only. URL credentials, query parameters, and fragments are removed when saving.',
	signInFooter: ios
		? 'A saved sign-in travels with this profile through iCloud Keychain.'
		: 'A saved sign-in stays with this profile and can be saved to Google Password Manager.',
	deleteMessage(item: string, isCurrent: boolean) {
		if (ios) {
			return isCurrent
				? `This removes the ${item} from iCloud but does not disconnect the current server.`
				: `This removes the ${item} from iCloud on your devices.`;
		}
		return isCurrent
			? `This removes the ${item} from this device but does not disconnect the current server.`
			: `This removes the ${item} from this device.`;
	},
	savedSignInPrompt: (profileName: string) =>
		ios
			? `Use the sign-in saved in iCloud for ${profileName}?`
			: `Use the saved sign-in for ${profileName}?`
} as const;
