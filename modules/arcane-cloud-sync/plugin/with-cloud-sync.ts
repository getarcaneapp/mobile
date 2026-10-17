import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';

export const withCloudSync: ConfigPlugin = (config) =>
	withEntitlementsPlist(config, (mod) => {
		const groups = [
			`$(AppIdentifierPrefix)${config.ios?.bundleIdentifier ?? 'app.getarcane.mobile'}`,
			'$(AppIdentifierPrefix)com.getarcaneapp.ios.mobile.shared',
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
