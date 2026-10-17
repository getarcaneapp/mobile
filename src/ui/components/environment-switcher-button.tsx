/**
 * Port of `EnvironmentSwitcherToolbarButton` (EnvironmentContextBar.swift):
 * an accent `server.rack` toolbar button with a 7pt status dot. Hidden in
 * All Environments preview or when there's only one environment.
 *
 * Standalone (`Stack.Toolbar` item, both platforms).
 */
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { Pressable, View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import {
	selectableEnvironments,
	type EnvironmentSwitcherButtonProps
} from './environment-context.types';
import { environmentStatusTint } from './resource-status';

export function EnvironmentSwitcherToolbarButton({
	environments,
	activeEnvironmentID,
	activeEnvironmentName,
	allEnvironmentsPreview,
	onPress,
	placement = 'right'
}: EnvironmentSwitcherButtonProps) {
	const accent = useAccentColor();
	const selectable = selectableEnvironments(environments, activeEnvironmentID);
	if (allEnvironmentsPreview || selectable.length <= 1) return null;
	const active = selectable.find((e) => e.id === activeEnvironmentID);
	const dot = environmentStatusTint(active?.status) ?? colors.secondaryLabel;

	return (
		<AppToolbar placement={placement}>
			<Stack.Toolbar.View>
				<Pressable
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel="Switch Environment"
					accessibilityValue={{ text: active?.displayName ?? activeEnvironmentName }}
					accessibilityHint="Shows all available environments"
					hitSlop={10}
				>
					<View>
						<Icon name="server.rack" size={20} color={accent} />
						<View
							style={{
								position: 'absolute',
								// Swift: 7pt dot + centered 1.5pt stroke (8.5pt overall), bottomTrailing offset (2, 2).
								right: -2.75,
								bottom: -2.75,
								width: 8.5,
								height: 8.5,
								borderRadius: 4.25,
								borderWidth: 1.5,
								borderColor: colors.systemBackground,
								backgroundColor: dot
							}}
						/>
					</View>
				</Pressable>
			</Stack.Toolbar.View>
		</AppToolbar>
	);
}
