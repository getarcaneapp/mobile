import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormNumberField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';

import { M3Section, SwitchRow } from '../shared/android-material';
import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';

import { useUserSettings } from './use-user-settings';

export function UserSettingsScreen() {
	const model = useUserSettings();
	const [refreshing, setRefreshing] = useState(false);
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'User Settings' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 16 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						colors={[m3.primary as string]}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section
					title="User Avatars"
					footer="Gravatar supplies a profile picture when a user has no uploaded avatar. These settings are stored on the Arcane manager."
				>
					<SwitchRow
						title="Enable Gravatar"
						icon="person.crop.circle"
						value={model.enableGravatar}
						onValueChange={model.setEnableGravatar}
					/>
					{model.supportsAvatarUploadLimit ? (
						<FormNumberField
							title="Maximum Upload Size"
							placeholder="2"
							text={model.avatarMaxUploadSizeMb}
							onChangeText={model.setAvatarMaxUploadSizeMb}
							minValue={1}
							maxValue={50}
							helper="Megabytes (1–50)"
						/>
					) : null}
				</M3Section>
				<FormErrorSection message={model.errorMessage} />
			</ScrollView>
			{model.isLoading && !refreshing ? (
				<View
					pointerEvents="none"
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						alignItems: 'center',
						justifyContent: 'center'
					}}
				>
					<ArcaneLoadingView label="Loading…" />
				</View>
			) : null}
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				isInteractionDisabled={model.isLoading}
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
