/** Port of `BuildSettingsView` (Views/Settings/System/BuildSettingsView.swift). */
import { Host } from '@/ui/host';
import { Form, Label, Section, Text } from '@expo/ui/swift-ui';
import { foregroundStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import {
	SettingsSaveBar,
	SettingsSaveBarSpacer
} from '@/features/settings/shared/settings-save-bar';
import type { EnvironmentID } from '@/sdk/client/environment';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	FormNumberField,
	FormPicker,
	FormSecureField,
	FormTextField
} from '@/ui/components/form-fields';

import { buildProviderOptions, useBuildSettings } from './use-build-settings';

export function BuildSettingsScreen({ environmentID }: { environmentID?: EnvironmentID }) {
	const model = useBuildSettings(environmentID);
	const { form } = model;
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'Builds', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form modifiers={[refreshable(model.loadSettings)]}>
					<Section
						header={<Label title="Build Workspace" systemImage="folder" />}
						footer={<Text>Directory used for build workspaces.</Text>}
					>
						<FormTextField
							title="Builds Directory"
							placeholder="/path/to/builds"
							text={form.buildsDirectory}
							onChangeText={model.setBuildsDirectory}
							autocapitalization="never"
							autocorrectionDisabled
							monospaced
							layout="stacked"
						/>
					</Section>

					<Section
						header={<Label title="Build Provider" systemImage="hammer" />}
						footer={
							<Text>Choose where Arcane runs image builds. Timeout is in seconds (60–14400).</Text>
						}
					>
						<FormPicker
							title="Build Provider"
							selection={form.buildProvider}
							onSelectionChange={model.setBuildProvider}
							options={buildProviderOptions}
						/>
						<FormNumberField
							title="Build Timeout"
							placeholder="1800"
							text={form.buildTimeout}
							onChangeText={model.setBuildTimeout}
							minValue={60}
							maxValue={14400}
						/>
					</Section>

					{form.buildProvider === 'depot' ? (
						<Section header={<Label title="Depot" systemImage="key" />}>
							<FormTextField
								title="Project ID"
								placeholder="Depot project ID"
								text={form.depotProjectId}
								onChangeText={model.setDepotProjectId}
								autocapitalization="never"
								autocorrectionDisabled
							/>
							<FormSecureField
								title="Depot Token"
								placeholder="Required for Depot builds"
								text={form.depotToken}
								onChangeText={model.setDepotToken}
							/>
						</Section>
					) : null}

					{model.errorMessage !== undefined ? (
						<Section>
							<Label
								title={model.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}

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
