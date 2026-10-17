/** Port of `AppearanceSettingsView` (AppearanceSettingsView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	RNHostView,
	Section,
	Spacer,
	Text,
	Toggle,
	ZStack
} from '@expo/ui/swift-ui';
import { foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { systemColors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { AccentColorMenu } from '@/ui/components/accent-color-menu';
import { selectedAccentOption } from '@/ui/components/accent-color-menu.types';
import { DisclosureChevron, SettingsRow } from '@/ui/settings-row';

import { AppearanceCopy, useAppearanceSettings } from './use-appearance-settings';

export function AppearanceSettingsScreen() {
	const model = useAppearanceSettings();
	useColorScheme(); // re-render on appearance change (systemColors resolve per appearance)
	const selectedOption = selectedAccentOption(model.accentPickerSelection);
	return (
		<>
			<Stack.Screen options={{ title: 'Appearance', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form>
					<Section footer={<Text>{AppearanceCopy.accentFooter}</Text>}>
						<HStack spacing={12}>
							{/* Swift: `selectedOption?.color`, the dynamic SwiftUI system color. */}
							<SettingsRow
								title="Accent Color"
								systemImage="paintpalette.fill"
								color={selectedOption ? systemColors[selectedOption.id] : model.selectedAccentColor}
							/>
							<Spacer />
							<AccentColorMenu
								selection={model.accentPickerSelection}
								onSelectionChange={model.setAccentColorHex}
							/>
						</HStack>
					</Section>

					<Section header={<Text>Motion</Text>} footer={<Text>{AppearanceCopy.motionFooter}</Text>}>
						<Toggle
							isOn={model.launchAnimationEnabled}
							onIsOnChange={model.setLaunchAnimationEnabled}
						>
							<SettingsRow
								title="Launch Animation"
								systemImage="sparkles"
								color={systemColors.purple}
							/>
						</Toggle>
					</Section>

					<Section
						header={<Text>Tab Bar</Text>}
						footer={<Text>{AppearanceCopy.tabBarFooter}</Text>}
					>
						<Button onPress={model.openEditTabs}>
							<HStack>
								<SettingsRow
									title="Edit Tabs"
									systemImage="rectangle.3.group.fill"
									color={systemColors.indigo}
								/>
								<Spacer />
								<DisclosureChevron />
							</HStack>
						</Button>
						<Toggle isOn={model.showTabLabels} onIsOnChange={model.setShowTabLabels}>
							<SettingsRow
								title="Show Tab Labels"
								systemImage="character.cursor.ibeam"
								color={systemColors.blue}
							/>
						</Toggle>
					</Section>

					{model.supportsAlternateIcons ? (
						<Section header={<Text>Icon</Text>}>
							<Button onPress={model.openAppIcon}>
								<HStack spacing={12}>
									<ZStack modifiers={[frame({ width: 32, height: 32 })]}>
										<RNHostView matchContents>
											<Image
												source={model.currentIconPreview}
												contentFit="contain"
												style={{
													width: 32,
													height: 32,
													borderRadius: Radius.small,
													borderCurve: 'continuous'
												}}
											/>
										</RNHostView>
									</ZStack>
									<Text modifiers={[foregroundStyle('primary')]}>App Icon</Text>
									<Spacer />
									<DisclosureChevron />
								</HStack>
							</Button>
						</Section>
					) : null}

					<Section>
						<Button
							label="Reset to Default"
							onPress={model.resetAccentColor}
							modifiers={[foregroundStyle(systemColors.red)]}
						/>
					</Section>
				</Form>
			</Host>
		</>
	);
}
