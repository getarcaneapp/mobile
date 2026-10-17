import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';

/**
 * Keychain access groups for iCloud Keychain sync.
 *
 * The app's own group stays first so it remains the default for items written
 * without an explicit group (expo-secure-store). The two reference-app groups
 * let this app read and write the Swift app's synchronizable profile and
 * sign-in items (same team, `4L6GXKX423`).
 */
export const withCloudSync: ConfigPlugin = (config) =>
	withEntitlementsPlist(config, (mod) => {
		const groups = [
			`$(AppIdentifierPrefix)${config.ios?.bundleIdentifier ?? 'app.getarcane.mobile'}`,
			// `SharedKeychain.accessGroup`: connection profiles.
			'$(AppIdentifierPrefix)com.getarcaneapp.ios.mobile.shared',
			// `SharedKeychain.appAccessGroup`: saved sign-ins.
			'$(AppIdentifierPrefix)com.getarcaneapp.ios.mobile'
		];
		const existing = mod.modResults['keychain-access-groups'];
		const current = Array.isArray(existing)
			? existing.filter((g): g is string => typeof g === 'string')
			: [];
		mod.modResults['keychain-access-groups'] = [...new Set([...groups, ...current])];
		return mod;
	});

export default withCloudSync;
