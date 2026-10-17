// Alternate app icons (AppIconPickerView.swift), driven by modules/arcane-app-icon.
//
// iOS: copies the reference app's alternate `.appiconset`s from
// assets/app-icons/ into the generated asset catalog (the picker's thumbnails
// are bundled JS assets in assets/app-icons/previews/), and sets the same build settings as the Swift project so
// actool compiles the alternates and lists them in `CFBundleAlternateIcons`.
//
// Android: renders each alternate into mipmaps (with `sips`), wraps it in an
// adaptive icon, and moves the MAIN/LAUNCHER intent filter from MainActivity
// onto one `<activity-alias>` per icon. Only the primary alias starts enabled.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
	AndroidConfig,
	withAndroidManifest,
	withDangerousMod,
	withXcodeProject,
	type ConfigPlugin
} from 'expo/config-plugins';

const ASSETS_DIR = 'assets/app-icons';

/** Matches the Swift project's `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`. */
export const ALTERNATE_APP_ICONS = [
	'AppIcon-Liquid-Glass-Light',
	'AppIcon-Liquid-Glass-Dark',
	'AppIcon-Techy-Arcane',
	'AppIcon-Development-Preview',
	'AppIcon-Blueprint',
	'AppIcon-Ember',
	'AppIcon-Hologram',
	'AppIcon-Terminal',
	'AppIcon-Porcelain'
] as const;

/** Meta-data key read by ArcaneAppIconModule.kt; value `AppIcon` is the primary icon. */
const META_KEY = 'app.getarcane.appIcon';
const PRIMARY = 'AppIcon';

// ---------------------------------------------------------------- iOS

const withIosIconAssets: ConfigPlugin = (config) =>
	withDangerousMod(config, [
		'ios',
		(config) => {
			const source = path.join(config.modRequest.projectRoot, ASSETS_DIR);
			const catalog = path.join(
				config.modRequest.platformProjectRoot,
				config.modRequest.projectName ?? 'Arcane',
				'Images.xcassets'
			);
			fs.mkdirSync(catalog, { recursive: true });
			for (const entry of fs.readdirSync(source)) {
				if (!entry.endsWith('.appiconset')) continue;
				const destination = path.join(catalog, entry);
				fs.rmSync(destination, { recursive: true, force: true });
				fs.cpSync(path.join(source, entry), destination, { recursive: true });
			}
			return config;
		}
	]);

const withIosIconBuildSettings: ConfigPlugin = (config) =>
	withXcodeProject(config, (config) => {
		const project = config.modResults;
		const configurations = project.pbxXCBuildConfigurationSection() as Record<string, unknown>;
		for (const value of Object.values(configurations)) {
			if (typeof value !== 'object' || value === null) continue;
			const settings = (value as { buildSettings?: Record<string, unknown> }).buildSettings;
			// App target configurations only (the project-level ones have no bundle ID).
			if (!settings || settings.PRODUCT_BUNDLE_IDENTIFIER === undefined) continue;
			settings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = `"${ALTERNATE_APP_ICONS.join(' ')}"`;
			settings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
		}
		return config;
	});

// ---------------------------------------------------------------- Android

/** Launcher icon layer is 108dp; mdpi = 1px per dp. */
const DENSITIES = {
	mdpi: 1,
	hdpi: 1.5,
	xhdpi: 2,
	xxhdpi: 3,
	xxxhdpi: 4
} as const;

const resourceSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const aliasName = (name: string) => `.MainActivity_${name.replace(/[^A-Za-z0-9]+/g, '_')}`;

/** The 1024px source image of an `.appiconset`. */
function appIconSource(appiconset: string): string {
	const contents = JSON.parse(fs.readFileSync(path.join(appiconset, 'Contents.json'), 'utf8')) as {
		images?: { filename?: string }[];
	};
	const file = contents.images?.find((image) => image.filename)?.filename;
	if (!file) throw new Error(`[with-app-icons] ${appiconset} has no image`);
	return path.join(appiconset, file);
}

const withAndroidIconResources: ConfigPlugin = (config) =>
	withDangerousMod(config, [
		'android',
		(config) => {
			const source = path.join(config.modRequest.projectRoot, ASSETS_DIR);
			const res = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
			for (const name of ALTERNATE_APP_ICONS) {
				const slug = `ic_launcher_${resourceSlug(name)}`;
				const image = appIconSource(path.join(source, `${name}.appiconset`));
				for (const [density, scale] of Object.entries(DENSITIES)) {
					const dir = path.join(res, `mipmap-${density}`);
					fs.mkdirSync(dir, { recursive: true });
					const size = String(Math.round(108 * scale));
					execFileSync(
						'sips',
						[
							'-s',
							'format',
							'png',
							'-z',
							size,
							size,
							image,
							'--out',
							path.join(dir, `${slug}_full.png`)
						],
						{
							stdio: 'ignore'
						}
					);
				}
				// The full-bleed iOS artwork fills the 72dp visible viewport; the same
				// image scaled to 108dp sits behind it so parallax never shows a gap.
				const drawable = path.join(res, 'drawable');
				fs.mkdirSync(drawable, { recursive: true });
				fs.writeFileSync(
					path.join(drawable, `${slug}_foreground.xml`),
					`<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@mipmap/${slug}_full"
    android:inset="16.667%" />
`
				);
				const anydpi = path.join(res, 'mipmap-anydpi-v26');
				fs.mkdirSync(anydpi, { recursive: true });
				fs.writeFileSync(
					path.join(anydpi, `${slug}.xml`),
					`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/${slug}_full" />
    <foreground android:drawable="@drawable/${slug}_foreground" />
</adaptive-icon>
`
				);
			}
			return config;
		}
	]);

type IntentFilter = NonNullable<AndroidConfig.Manifest.ManifestActivity['intent-filter']>[number];
type ActivityAlias = NonNullable<
	AndroidConfig.Manifest.ManifestApplication['activity-alias']
>[number];

const isLauncherFilter = (filter: IntentFilter) =>
	(filter.action ?? []).some(
		(action) => action.$['android:name'] === 'android.intent.action.MAIN'
	) &&
	(filter.category ?? []).some(
		(category) => category.$['android:name'] === 'android.intent.category.LAUNCHER'
	);

const launcherFilter = (): IntentFilter => ({
	action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
	category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }]
});

function alias(iconName: string, icon: string, roundIcon: string, enabled: boolean): ActivityAlias {
	return {
		$: {
			'android:name': aliasName(iconName),
			'android:targetActivity': '.MainActivity',
			'android:enabled': String(enabled),
			'android:exported': 'true',
			'android:icon': icon,
			'android:roundIcon': roundIcon
		} as ActivityAlias['$'],
		'intent-filter': [launcherFilter()],
		'meta-data': [{ $: { 'android:name': META_KEY, 'android:value': iconName } }]
	} as ActivityAlias;
}

const withAndroidIconAliases: ConfigPlugin = (config) =>
	withAndroidManifest(config, (config) => {
		const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
		const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
		mainActivity['intent-filter'] = (mainActivity['intent-filter'] ?? []).filter(
			(filter) => !isLauncherFilter(filter)
		);

		const existing = (application['activity-alias'] ?? []).filter(
			(entry) => !(entry['meta-data'] ?? []).some((meta) => meta.$['android:name'] === META_KEY)
		);
		application['activity-alias'] = [
			...existing,
			alias(PRIMARY, '@mipmap/ic_launcher', '@mipmap/ic_launcher_round', true),
			...ALTERNATE_APP_ICONS.map((name) => {
				const icon = `@mipmap/ic_launcher_${resourceSlug(name)}`;
				return alias(name, icon, icon, false);
			})
		];
		return config;
	});

const withAppIcons: ConfigPlugin = (config) =>
	withAndroidIconAliases(
		withAndroidIconResources(withIosIconBuildSettings(withIosIconAssets(config)))
	);

export default withAppIcons;
