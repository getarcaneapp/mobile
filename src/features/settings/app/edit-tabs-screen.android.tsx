/**
 * Android rendering of `EditTabsView` (SettingsView.swift). Tapping a row
 * opens its replacements; the arrow buttons stand in for drag-to-reorder.
 */
import { MenuView } from '@react-native-menu/menu';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { iconColor, systemImage, tabTitle } from '@/core/app-tab';
import { colors, systemColors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow } from '../shared/android-material';
import { EditTabsCopy, useEditTabs } from './use-edit-tabs';

function MoveButton({
	icon,
	label,
	disabled,
	onPress
}: {
	icon: string;
	label: string;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
			style={{
				width: 40,
				height: 40,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: disabled ? 0.3 : 1
			}}
		>
			<Icon name={icon} size={20} color={colors.secondaryLabel} />
		</Pressable>
	);
}

export function EditTabsScreen() {
	const model = useEditTabs();
	const last = model.selection.length - 1;
	return (
		<>
			<Stack.Screen options={{ title: 'Edit Tabs' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section title="Tab Bar" footer={EditTabsCopy.footer}>
					{model.selection.map((tab, index) => (
						<View key={tab} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
							<MenuView
								style={{ flex: 1 }}
								shouldOpenOnLongPress={false}
								actions={model.replacements(tab).map((replacement) => ({
									id: replacement,
									title: tabTitle[replacement],
									state: replacement === tab ? 'on' : 'off'
								}))}
								onPressAction={({ nativeEvent }) => {
									const replacement = model
										.replacements(tab)
										.find((candidate) => candidate === nativeEvent.event);
									if (replacement) model.replaceTab(index, replacement);
								}}
							>
								<View
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 16,
										minHeight: 56,
										paddingLeft: 16
									}}
								>
									<Icon name={systemImage[tab]} size={24} color={systemColors[iconColor(tab)]} />
									<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
										{tabTitle[tab]}
									</Text>
									<Text
										style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}
									>{`Tab ${index + 1}`}</Text>
									<Icon name="chevron.up.chevron.down" size={16} color={colors.tertiaryLabel} />
								</View>
							</MenuView>
							<MoveButton
								icon="chevron.up"
								label={`Move ${tabTitle[tab]} up`}
								disabled={index === 0}
								onPress={() => model.moveTabs([index], index - 1)}
							/>
							<MoveButton
								icon="chevron.down"
								label={`Move ${tabTitle[tab]} down`}
								disabled={index === last}
								onPress={() => model.moveTabs([index], index + 2)}
							/>
						</View>
					))}
				</M3Section>
				<M3Section>
					<TextButtonRow title="Reset to Defaults" onPress={model.resetToDefaults} />
				</M3Section>
			</ScrollView>
		</>
	);
}
