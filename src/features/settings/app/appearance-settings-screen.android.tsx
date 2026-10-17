import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { AccentColorMenu } from '@/ui/components/accent-color-menu';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { M3Section, TextButtonRow } from '../shared/android-material';
import { IconSwitchRow } from './android-rows';
import { AppearanceCopy, useAppearanceSettings } from './use-appearance-settings';

export function AppearanceSettingsScreen() {
	const model = useAppearanceSettings();
	return (
		<>
			<Stack.Screen options={{ title: 'Appearance' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section footer={AppearanceCopy.accentFooter}>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 16,
							minHeight: 56,
							paddingHorizontal: 16
						}}
					>
						<Icon name="paintpalette.fill" size={24} color={model.selectedAccentColor} />
						<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>Accent Color</Text>
						<AccentColorMenu
							selection={model.accentPickerSelection}
							onSelectionChange={model.setAccentColorHex}
						/>
					</View>
				</M3Section>

				<M3Section title="Motion" footer={AppearanceCopy.motionFooter}>
					<IconSwitchRow
						title="Launch Animation"
						icon="sparkles"
						iconColor={systemColors.purple}
						value={model.launchAnimationEnabled}
						onValueChange={model.setLaunchAnimationEnabled}
					/>
				</M3Section>

				<M3Section
					title="Tab Bar"
					footer={AppearanceCopy.tabBarFooter.replace('VoiceOver', 'TalkBack')}
				>
					<MaterialListItem
						headline="Edit Tabs"
						icon="rectangle.3.group.fill"
						iconColor={systemColors.indigo}
						onPress={model.openEditTabs}
					/>
					<IconSwitchRow
						title="Show Tab Labels"
						icon="character.cursor.ibeam"
						iconColor={systemColors.blue}
						value={model.showTabLabels}
						onValueChange={model.setShowTabLabels}
					/>
				</M3Section>

				{model.supportsAlternateIcons ? (
					<M3Section title="Icon">
						<MaterialListItem
							headline="App Icon"
							leading={
								<Image
									source={model.currentIconPreview}
									contentFit="contain"
									style={{ width: 32, height: 32, borderRadius: Radius.small }}
								/>
							}
							onPress={model.openAppIcon}
						/>
					</M3Section>
				) : null}

				<M3Section>
					<TextButtonRow title="Reset to Default" destructive onPress={model.resetAccentColor} />
				</M3Section>
			</ScrollView>
		</>
	);
}
