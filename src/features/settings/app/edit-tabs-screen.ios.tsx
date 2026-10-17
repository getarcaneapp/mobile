import { Host } from '@/ui/host';
import { Button, HStack, Label, List, Menu, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	contentShape,
	environment,
	font,
	foregroundStyle,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { iconColor, systemImage, tabTitle } from '@/core/app-tab';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { SettingsRow } from '@/ui/settings-row';

import { EditTabsCopy, useEditTabs } from './use-edit-tabs';

export function EditTabsScreen() {
	const accent = useAccentColor();
	const model = useEditTabs();
	const [isEditing, setIsEditing] = useState(false);
	return (
		<>
			<Stack.Screen options={{ title: 'Edit Tabs', headerLargeTitleEnabled: false }} />
			<AppToolbar placement="right" tintColor={accent}>
				{isEditing ? (
					<Stack.Toolbar.Button
						variant="done"
						icon="checkmark"
						accessibilityLabel="Done"
						onPress={() => setIsEditing(false)}
					/>
				) : (
					<Stack.Toolbar.Button variant="plain" onPress={() => setIsEditing(true)}>
						Edit
					</Stack.Toolbar.Button>
				)}
			</AppToolbar>
			<Host style={{ flex: 1 }}>
				<List modifiers={[environment('editMode', isEditing ? 'active' : 'inactive')]}>
					<Section header={<Text>Tab Bar</Text>} footer={<Text>{EditTabsCopy.footer}</Text>}>
						<List.ForEach onMove={model.moveTabs}>
							{model.selection.map((tab, index) => (
								<Menu
									key={tab}
									label={
										<HStack modifiers={[contentShape(shapes.rectangle())]}>
											<SettingsRow
												title={tabTitle[tab]}
												systemImage={systemImage[tab]}
												color={systemColors[iconColor(tab)]}
											/>
											<Spacer />
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' })
												]}
											>
												{`Tab ${index + 1}`}
											</Text>
											<Image
												systemName="chevron.up.chevron.down"
												modifiers={[
													font({ textStyle: 'caption', weight: 'semibold' }),
													foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
												]}
											/>
										</HStack>
									}
								>
									{model.replacements(tab).map((replacement) => (
										<Button key={replacement} onPress={() => model.replaceTab(index, replacement)}>
											<Label
												title={tabTitle[replacement]}
												systemImage={systemImage[replacement] as SFSymbol}
											/>
										</Button>
									))}
								</Menu>
							))}
						</List.ForEach>
					</Section>
					<Section>
						<Button
							label="Reset to Defaults"
							systemImage="arrow.counterclockwise"
							onPress={model.resetToDefaults}
						/>
					</Section>
				</List>
			</Host>
		</>
	);
}
