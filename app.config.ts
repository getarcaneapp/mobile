import fs from 'node:fs';

import type { ExpoConfig } from 'expo/config';

import withCloudSync from './modules/arcane-cloud-sync/plugin/with-cloud-sync.ts';
import withAppIcons from './plugins/with-app-icons.ts';
import withMaterial3Theme from './plugins/with-material3-theme.ts';
import withReleaseScheme from './plugins/with-release-scheme.ts';

const MARKETING_VERSION = '0.12.0';

const buildEpochMs = Date.UTC(2020, 0, 1);
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const arcaneBuildNumber = env?.ARCANE_BUILD_NUMBER;
const googleServicesFile =
	env?.GOOGLE_SERVICES_JSON ??
	(fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
const BUILD_NUMBER = Number(arcaneBuildNumber) || Math.floor((Date.now() - buildEpochMs) / 60_000);

const config: ExpoConfig = {
	name: 'Arcane',
	slug: 'arcane-mobile',
	owner: 'getarcaneapp',
	version: MARKETING_VERSION,
	orientation: 'default',
	icon: './assets/images/icon.png',
	scheme: 'arcane-mobile',
	userInterfaceStyle: 'automatic',
	ios: {
		bundleIdentifier: 'com.getarcaneapp.ios.mobile',
		buildNumber: String(BUILD_NUMBER),
		appleTeamId: '4L6GXKX423',
		supportsTablet: true,
		icon: {
			light: './assets/images/icon.png',
			dark: './assets/images/icon-dark.png'
		},
		entitlements: {
			'com.apple.security.application-groups': ['group.com.getarcaneapp.ios.mobile']
		},
		infoPlist: {
			ITSAppUsesNonExemptEncryption: false,
			NSSupportsLiveActivities: true,
			NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
			NSFaceIDUsageDescription: 'Arcane uses Face ID to unlock saved credentials.'
		}
	},
	android: {
		package: 'app.getarcane.android',
		versionCode: BUILD_NUMBER,
		adaptiveIcon: {
			backgroundImage: './assets/images/android-icon-background.png',
			foregroundImage: './assets/images/android-icon-foreground.png',
			monochromeImage: './assets/images/android-icon-monochrome.png'
		},
		predictiveBackGestureEnabled: true,
		googleServicesFile
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
		[
			'expo-notifications',
			{
				icon: './assets/images/notification-icon.png',
				color: '#AF52DE',
				defaultChannel: 'arcane'
			}
		],
		'expo-secure-store',
		'@bacons/apple-targets',
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
	},
	extra: {
		eas: { projectId: 'ae4b7a03-2ba2-4ed1-9610-465565ce7c42' }
	}
};

export default withReleaseScheme(withMaterial3Theme(withAppIcons(withCloudSync(config))));
