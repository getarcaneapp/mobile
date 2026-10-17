import fs from 'node:fs';
import path from 'node:path';

import {
	AndroidConfig,
	withAndroidStyles,
	withAppBuildGradle,
	withDangerousMod,
	type ConfigPlugin
} from 'expo/config-plugins';

const MATERIAL_VERSION = '1.13.0';
const MATERIAL_DEPENDENCY = `implementation "com.google.android.material:material:${MATERIAL_VERSION}"`;

const APP_THEME_PARENT = 'Theme.Material3.DynamicColors.DayNight.NoActionBar';
const DIALOG_OVERLAY = 'ThemeOverlay.App.AlertDialog';
const DIALOG_BACKGROUND = 'app_alert_dialog_background';

const DIALOG_BACKGROUND_XML = `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:insetLeft="24dp"
    android:insetRight="24dp"
    android:insetTop="80dp"
    android:insetBottom="80dp">
  <shape android:shape="rectangle">
    <corners android:radius="28dp" />
    <solid android:color="?attr/colorSurfaceContainerHigh" />
  </shape>
</inset>
`;

const withMaterialDependency: ConfigPlugin = (config) =>
	withAppBuildGradle(config, (mod) => {
		if (!mod.modResults.contents.includes('com.google.android.material:material')) {
			mod.modResults.contents = mod.modResults.contents.replace(
				/dependencies\s*\{/,
				(match) => `${match}\n    ${MATERIAL_DEPENDENCY}`
			);
		}
		return mod;
	});

const withDialogBackground: ConfigPlugin = (config) =>
	withDangerousMod(config, [
		'android',
		(config) => {
			const drawables = path.join(
				config.modRequest.platformProjectRoot,
				'app',
				'src',
				'main',
				'res',
				'drawable'
			);
			fs.mkdirSync(drawables, { recursive: true });
			fs.writeFileSync(path.join(drawables, `${DIALOG_BACKGROUND}.xml`), DIALOG_BACKGROUND_XML);
			return config;
		}
	]);

const withMaterialStyles: ConfigPlugin = (config) =>
	withAndroidStyles(config, (mod) => {
		const { Styles } = AndroidConfig;
		let styles = mod.modResults;

		const appTheme = Styles.getAppThemeGroup();
		const resources = styles.resources;
		const appStyle = resources.style?.find((style) => style.$.name === appTheme.name);
		if (appStyle) appStyle.$.parent = APP_THEME_PARENT;

		const overlay = { name: DIALOG_OVERLAY, parent: 'ThemeOverlay.Material3.Dialog.Alert' };
		const dialogItems: Record<string, string> = {
			'android:windowBackground': `@drawable/${DIALOG_BACKGROUND}`,
			'android:backgroundDimAmount': '0.32',
			buttonBarPositiveButtonStyle: '@style/Widget.Material3.Button.TextButton.Dialog',
			buttonBarNegativeButtonStyle: '@style/Widget.Material3.Button.TextButton.Dialog',
			buttonBarNeutralButtonStyle: '@style/Widget.Material3.Button.TextButton.Dialog.Flush'
		};
		for (const [name, value] of Object.entries(dialogItems)) {
			styles = Styles.assignStylesValue(styles, { add: true, parent: overlay, name, value });
		}

		styles = Styles.assignStylesValue(styles, {
			add: true,
			parent: appTheme,
			name: 'alertDialogTheme',
			value: `@style/${DIALOG_OVERLAY}`
		});
		styles = Styles.assignStylesValue(styles, {
			add: false,
			parent: appTheme,
			name: 'colorPrimary',
			value: ''
		});

		mod.modResults = styles;
		return mod;
	});

export const withMaterial3Theme: ConfigPlugin = (config) =>
	withMaterialStyles(withDialogBackground(withMaterialDependency(config)));

export default withMaterial3Theme;
