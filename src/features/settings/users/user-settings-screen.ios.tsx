import { Host } from '@/ui/host';
import { Form, Label, Section, Text, Toggle } from '@expo/ui/swift-ui';
import { refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormNumberField } from '@/ui/components/form-fields';

import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';

import { useUserSettings } from './use-user-settings';

export function UserSettingsScreen() {
	const model = useUserSettings();
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'User Settings', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form modifiers={[refreshable(model.load)]}>
					<Section
						header={<Label title="User Avatars" systemImage="person.crop.circle" />}
						footer={
							<Text>
								Gravatar supplies a profile picture when a user has no uploaded avatar. These
								settings are stored on the Arcane manager.
							</Text>
						}
					>
						<Toggle
							label="Enable Gravatar"
							isOn={model.enableGravatar}
							onIsOnChange={model.setEnableGravatar}
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
					</Section>
					<FormErrorSection message={model.errorMessage} />
					<SettingsSaveBarSpacer />
				</Form>
			</Host>
			{model.isLoading ? (
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
