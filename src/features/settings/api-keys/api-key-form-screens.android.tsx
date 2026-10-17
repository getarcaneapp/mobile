import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormTextField } from '@/ui/components/form-fields';
import { PartialDataNotice } from '@/ui/components/resource-detail';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, M3TextField, SwitchRow, ValueRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { DatePickerRow } from '../shared/date-picker-row';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';
import { PermissionPicker } from './permission-picker';
import { useCreateAPIKey, useEditAPIKey } from './use-api-key-form';

const permissionsFooter = 'Select at least one permission. API keys cannot exceed your own access.';

function KeyDetailsFields(props: {
	name: string;
	setName: (text: string) => void;
	description: string;
	setDescription: (text: string) => void;
}) {
	return (
		<>
			<FormTextField
				title="Name"
				placeholder="CI deploy key"
				text={props.name}
				onChangeText={props.setName}
			/>
			<FormTextField
				title="Description"
				placeholder="Optional"
				text={props.description}
				onChangeText={props.setDescription}
				axis="vertical"
				lineLimit={{ min: 2, max: 4 }}
			/>
		</>
	);
}

function InlineNotice({ icon, color, text }: { icon: string; color: string; text: string }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
			<Icon name={icon} size={20} color={color} />
			<Text style={[m3Type.bodyMedium, { color, flex: 1 }]}>{text}</Text>
		</View>
	);
}

function ErrorSection({ message }: { message: string | undefined }) {
	if (!message) return null;
	return (
		<M3Section>
			<InlineNotice icon="exclamationmark.triangle" color={systemColors.red} text={message} />
		</M3Section>
	);
}

function PermissionsBlock({
	search,
	setSearch,
	children
}: {
	search: string;
	setSearch: (text: string) => void;
	children: ReactNode;
}) {
	return (
		<View>
			<View style={{ marginTop: 12 }}>
				<M3Section title="Permissions">
					<M3TextField label="Search permissions" value={search} onChangeText={setSearch} />
				</M3Section>
			</View>
			{children}
			<Text
				style={[
					m3Type.bodySmall,
					{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
				]}
			>
				{permissionsFooter}
			</Text>
		</View>
	);
}

export function CreateAPIKeyScreen() {
	const model = useCreateAPIKey();
	return (
		<>
			<Stack.Screen options={{ title: 'Create API Key', headerBackVisible: !model.isLoading }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'create',
						icon: 'checkmark',
						label: 'Create',
						disabled: !model.canCreate,
						onPress: model.createKey
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
				pointerEvents={model.isLoading ? 'none' : 'auto'}
			>
				<M3Section
					title="Key Details"
					footer="Use a name that identifies where this key will be used."
				>
					<KeyDetailsFields
						name={model.name}
						setName={model.setName}
						description={model.description}
						setDescription={model.setDescription}
					/>
				</M3Section>
				<M3Section
					title="Expiration"
					footer={
						model.hasExpiration
							? 'The key stops working after this date.'
							: 'The key remains active until it is deleted or rotated.'
					}
				>
					<SwitchRow
						title="Set Expiration"
						value={model.hasExpiration}
						onValueChange={model.setHasExpiration}
					/>
					{model.hasExpiration ? (
						<DatePickerRow
							title="Expiration Date"
							value={model.expiresAt}
							minimumDate={new Date()}
							onChange={model.setExpiresAt}
						/>
					) : null}
				</M3Section>
				{model.supportsRBAC ? (
					model.manifest ? (
						<PermissionsBlock search={model.permissionSearch} setSearch={model.setPermissionSearch}>
							<PermissionPicker
								manifest={model.manifest}
								selected={model.selectedPermissions}
								onSelectedChange={model.setSelectedPermissions}
								search={model.permissionSearch}
							/>
						</PermissionsBlock>
					) : (
						<M3Section>
							<View style={{ padding: 16, alignItems: 'center' }}>
								{model.isLoadingPermissions ? (
									<ArcaneLoadingView label="Loading permissions…" />
								) : (
									<InlineNotice
										icon="exclamationmark.triangle"
										color={colors.secondaryLabel as string}
										text="Permissions unavailable"
									/>
								)}
							</View>
						</M3Section>
					)
				) : null}
				<ErrorSection message={model.errorMessage} />
			</ScrollView>
		</>
	);
}

export function EditAPIKeyScreen() {
	const model = useEditAPIKey();
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'Edit API Key', headerBackVisible: !model.isSaving }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 24 }}
				keyboardShouldPersistTaps="handled"
				pointerEvents={model.isSaving ? 'none' : 'auto'}
			>
				<M3Section title="Key Details">
					<KeyDetailsFields
						name={model.name}
						setName={model.setName}
						description={model.description}
						setDescription={model.setDescription}
					/>
				</M3Section>
				<M3Section
					title="Expiration"
					footer={
						model.hadExpiration
							? 'The expiration date can be changed but cannot be removed from an existing key.'
							: undefined
					}
				>
					{!model.hadExpiration ? (
						<SwitchRow
							title="Set Expiration"
							value={model.hasExpiration}
							onValueChange={model.setHasExpiration}
						/>
					) : null}
					{model.hasExpiration ? (
						<DatePickerRow
							title="Expiration Date"
							value={model.expiresAt}
							onChange={model.setExpiresAt}
						/>
					) : (
						<ValueRow title="Expiration" value="Never" />
					)}
				</M3Section>
				{model.supportsRBAC ? (
					model.isPersonal ? (
						<M3Section title="Permissions">
							<InlineNotice
								icon="person.badge.key.fill"
								color={colors.secondaryLabel as string}
								text="Personal keys inherit the assigned user's role permissions."
							/>
						</M3Section>
					) : model.manifest && model.metadata?.permissions !== undefined ? (
						<PermissionsBlock search={model.permissionSearch} setSearch={model.setPermissionSearch}>
							<PermissionPicker
								manifest={model.manifest}
								selected={model.selectedPermissions}
								onSelectedChange={model.setSelectedPermissions}
								search={model.permissionSearch}
							/>
						</PermissionsBlock>
					) : (
						<M3Section title="Permissions">
							{model.isLoadingPermissions ? (
								<View style={{ padding: 16, alignItems: 'center' }}>
									<ArcaneLoadingView label="Loading permissions…" />
								</View>
							) : (
								<PartialDataNotice message="Existing permissions will be preserved because they could not be loaded." />
							)}
						</M3Section>
					)
				) : null}
				<ErrorSection message={model.errorMessage} />
			</ScrollView>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.canSave}
				onSave={model.save}
				onRevert={model.revertChanges}
				reservesTabBarSpace={false}
			/>
		</View>
	);
}
