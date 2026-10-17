/** Android (Material 3) rendering of `BuildSettingsView` (BuildSettingsView.swift). */
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import {
	SettingsSaveBar,
	settingsSaveBarHeight
} from '@/features/settings/shared/settings-save-bar';
import type { EnvironmentID } from '@/sdk/client/environment';
import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	FormNumberField,
	FormPicker,
	FormSecureField,
	FormTextField
} from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { buildProviderOptions, useBuildSettings } from './use-build-settings';

function FormSection({
	title,
	icon,
	footer,
	children
}: {
	title?: string;
	icon?: string;
	footer?: string;
	children: ReactNode;
}) {
	return (
		<View>
			{title ? (
				<View
					accessibilityRole="header"
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						paddingHorizontal: 16,
						paddingTop: 20,
						paddingBottom: 6
					}}
				>
					{icon ? <Icon name={icon} size={18} color={colors.secondaryLabel} /> : null}
					<Text style={[m3Type.titleSmall, { color: colors.secondaryLabel }]}>{title}</Text>
				</View>
			) : (
				<View style={{ height: 12 }} />
			)}
			<MaterialListGroup>{children}</MaterialListGroup>
			{footer ? (
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
					]}
				>
					{footer}
				</Text>
			) : null}
		</View>
	);
}

export function BuildSettingsScreen({ environmentID }: { environmentID?: EnvironmentID }) {
	const model = useBuildSettings(environmentID);
	const { form } = model;
	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: 'Builds' }} />
			<ScrollView
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 16 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={false}
						onRefresh={() => void model.loadSettings()}
						colors={[m3.primary as string]}
					/>
				}
			>
				<FormSection
					title="Build Workspace"
					icon="folder"
					footer="Directory used for build workspaces."
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
				</FormSection>

				<FormSection
					title="Build Provider"
					icon="hammer"
					footer="Choose where Arcane runs image builds. Timeout is in seconds (60–14400)."
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
				</FormSection>

				{form.buildProvider === 'depot' ? (
					<FormSection title="Depot" icon="key">
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
					</FormSection>
				) : null}

				{model.errorMessage !== undefined ? (
					<FormSection>
						<View
							accessibilityRole="alert"
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 16,
								minHeight: 56,
								paddingHorizontal: 16,
								paddingVertical: 12
							}}
						>
							<Icon name="exclamationmark.triangle" size={22} color={m3.error} />
							<Text style={[m3Type.bodyLarge, { flex: 1, color: m3.error }]}>
								{model.errorMessage}
							</Text>
						</View>
					</FormSection>
				) : null}
			</ScrollView>
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
