import type { ExpoConfig } from 'expo/config';

import withCloudSync from './modules/arcane-cloud-sync/plugin/with-cloud-sync.ts';
import withAppIcons from './plugins/with-app-icons.ts';
import withMaterial3Theme from './plugins/with-material3-theme.ts';
import withReleaseScheme from './plugins/with-release-scheme.ts';

const MARKETING_VERSION = '0.11.0';

const config: ExpoConfig = {
	name: 'Arcane',
	slug: 'arcane-mobile',
	version: MARKETING_VERSION,
	orientation: 'default',
	icon: './assets/images/icon.png',
	scheme: 'arcane-mobile',
	userInterfaceStyle: 'automatic',
	ios: {
		bundleIdentifier: 'app.getarcane.mobile',
		appleTeamId: '4L6GXKX423',
		supportsTablet: true,
		icon: {
			light: './assets/images/icon.png',
			dark: './assets/images/icon-dark.png'
		},
		infoPlist: {
			ITSAppUsesNonExemptEncryption: false,
			NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
			NSFaceIDUsageDescription: 'Arcane uses Face ID to unlock saved credentials.'
		}
	},
	android: {
		package: 'app.getarcane.mobile',
		adaptiveIcon: {
			backgroundColor: '#0B0B12',
			foregroundImage: './assets/images/android-icon-foreground.png',
			monochromeImage: './assets/images/android-icon-monochrome.png'
		},
		predictiveBackGestureEnabled: true
	},
	plugins: [
		'expo-router',
		[
			'expo-splash-screen',
			{
				backgroundColor: '#FFFFFF',
				dark: { backgroundColor: '#000000' },
				image: './assets/images/launch-blank.png',
				imageWidth: 1
			}
		],
		'expo-secure-store',
		'expo-localization',
		'expo-sharing',
		[
			'expo-build-properties',
			{
				ios: { deploymentTarget: '18.0' },
				android: {
					minSdkVersion: 26,
					usesCleartextTraffic: true
				}
			}
		]
	],
	experiments: {
		typedRoutes: true,
		reactCompiler: true
	}
};

export default withReleaseScheme(withMaterial3Theme(withAppIcons(withCloudSync(config))));
