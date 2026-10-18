import { Keys, useStoredBool } from '@/core/storage';
import { AccentColorOptions, useAccentColorHex } from '@/theme/accent';
import { parseHex, systemColors } from '@/theme/colors';

import { useSettingsNavigation } from '../shared/settings-routes';
import { AlternateAppIcons, useAppIconState } from './alternate-app-icons';
import { AppSettingsRoutes } from './app-settings-routes';

const purpleHex = '#AF52DE';

export function useAppearanceSettings() {
	const navigation = useSettingsNavigation();
	const [accentColorHex, setAccentColorHex] = useAccentColorHex();
	const [launchAnimationEnabled, setLaunchAnimationEnabled] = useStoredBool(
		Keys.launchAnimationEnabled,
		true
	);
	const [showTabLabels, setShowTabLabels] = useStoredBool(Keys.showTabLabels, false);
	const icon = useAppIconState();

	const selectedOption =
		accentColorHex === ''
			? AccentColorOptions.find((option) => option.id === 'purple')
			: AccentColorOptions.find(
					(option) => option.hex.toLowerCase() === accentColorHex.toLowerCase()
				);

	return {
		selectedAccentColor: selectedOption?.hex ?? parseHex(accentColorHex) ?? systemColors.purple,
		accentPickerSelection: selectedOption?.hex ?? purpleHex,
		setAccentColorHex,
		resetAccentColor: () => setAccentColorHex(''),
		launchAnimationEnabled,
		setLaunchAnimationEnabled,
		showTabLabels,
		setShowTabLabels,
		supportsAlternateIcons: icon.supportsAlternateIcons,
		currentIconPreview: AlternateAppIcons.previewFor(icon.currentIconName),
		openEditTabs: () => navigation.push(AppSettingsRoutes.editTabs),
		openAppIcon: () => navigation.push(AppSettingsRoutes.appIcon)
	};
}

export const AppearanceCopy = {
	tabBarFooter:
		'Hide labels for evenly sized tab bar items. Tab names remain available to VoiceOver.'
} as const;
