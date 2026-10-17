import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	DatePicker,
	Form,
	HStack,
	Label,
	LabeledContent,
	NavigationStack,
	Section,
	Spacer,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem,
	useNativeState
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	searchable,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormTextField } from '@/ui/components/form-fields';
import { PartialDataNotice } from '@/ui/components/resource-detail';
import { ToastHost } from '@/ui/toast';

import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';
import { PermissionPicker } from './permission-picker';
import { useCreateAPIKey, useEditAPIKey } from './use-api-key-form';

const permissionsFooter = 'Select at least one permission. API keys cannot exceed your own access.';

function usePermissionSearchModifier(
	enabled: boolean,
	onChange: (text: string) => void
): ModifierConfig[] {
	const text = useNativeState('');
	return enabled
		? [
				searchable(text, {
					placement: 'navigationBarDrawer',
					prompt: 'Search permissions',
					onChange
				})
			]
		: [];
}

function KeyDetailsFields({
	name,
	setName,
	description,
	setDescription
}: {
	name: string;
	setName: (text: string) => void;
	description: string;
	setDescription: (text: string) => void;
}) {
	return (
		<>
			<FormTextField title="Name" placeholder="CI deploy key" text={name} onChangeText={setName} />
			<FormTextField
				title="Description"
				placeholder="Optional"
				text={description}
				onChangeText={setDescription}
				axis="vertical"
				lineLimit={{ min: 2, max: 4 }}
			/>
		</>
	);
}

function ErrorSection({ message }: { message: string | undefined }) {
	if (!message) return null;
	return (
		<Section>
			<Label
				title={message}
				systemImage="exclamationmark.triangle"
				modifiers={[foregroundStyle(systemColors.red)]}
			/>
		</Section>
	);
}

function Sheet({ children }: { children: ReactNode }) {
	return (
		<View style={{ flex: 1 }}>
			{children}
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}

export function CreateAPIKeyScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useCreateAPIKey();
	const search = usePermissionSearchModifier(model.supportsRBAC, model.setPermissionSearch);
	return (
		<Sheet>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Create API Key'),
								navigationBarTitleDisplayMode('inline'),
								...search,
								disabled(model.isLoading)
							]}
						>
							<Section
								header={<Text>Key Details</Text>}
								footer={<Text>Use a name that identifies where this key will be used.</Text>}
							>
								<KeyDetailsFields
									name={model.name}
									setName={model.setName}
									description={model.description}
									setDescription={model.setDescription}
								/>
							</Section>
							<Section
								header={<Text>Expiration</Text>}
								footer={
									<Text>
										{model.hasExpiration
											? 'The key stops working after this date.'
											: 'The key remains active until it is deleted or rotated.'}
									</Text>
								}
							>
								<Toggle
									label="Set Expiration"
									isOn={model.hasExpiration}
									onIsOnChange={model.setHasExpiration}
								/>
								{model.hasExpiration ? (
									<DatePicker
										title="Expiration Date"
										selection={model.expiresAt}
										range={{ start: new Date() }}
										displayedComponents={['date']}
										onDateChange={model.setExpiresAt}
									/>
								) : null}
							</Section>
							{model.supportsRBAC ? (
								model.manifest ? (
									<>
										<PermissionPicker
											manifest={model.manifest}
											selected={model.selectedPermissions}
											onSelectedChange={model.setSelectedPermissions}
											search={model.permissionSearch}
										/>
										<Section footer={<Text>{permissionsFooter}</Text>}>{null}</Section>
									</>
								) : (
									<Section>
										<HStack>
											<Spacer />
											{model.isLoadingPermissions ? (
												<ArcaneLoadingViewSwiftUI label="Loading permissions…" />
											) : (
												<Label
													title="Permissions unavailable"
													systemImage="exclamationmark.triangle"
													modifiers={[
														foregroundStyle({ type: 'hierarchical', style: 'secondary' })
													]}
												/>
											)}
											<Spacer />
										</HStack>
									</Section>
								)
							) : null}
							<ErrorSection message={model.errorMessage} />
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isLoading), ...toolbarSymbol]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Create"
									onPress={model.createKey}
									modifiers={[disabled(!model.canCreate), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</Sheet>
	);
}

export function EditAPIKeyScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useEditAPIKey();
	const search = usePermissionSearchModifier(
		model.showsPermissionPicker,
		model.setPermissionSearch
	);
	return (
		<Sheet>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Edit API Key'),
								navigationBarTitleDisplayMode('inline'),
								...search,
								disabled(model.isSaving)
							]}
						>
							<Section header={<Text>Key Details</Text>}>
								<KeyDetailsFields
									name={model.name}
									setName={model.setName}
									description={model.description}
									setDescription={model.setDescription}
								/>
							</Section>
							<Section
								header={<Text>Expiration</Text>}
								footer={
									model.hadExpiration ? (
										<Text>
											The expiration date can be changed but cannot be removed from an existing key.
										</Text>
									) : undefined
								}
							>
								{!model.hadExpiration ? (
									<Toggle
										label="Set Expiration"
										isOn={model.hasExpiration}
										onIsOnChange={model.setHasExpiration}
									/>
								) : null}
								{model.hasExpiration ? (
									<DatePicker
										title="Expiration Date"
										selection={model.expiresAt}
										displayedComponents={['date']}
										onDateChange={model.setExpiresAt}
									/>
								) : (
									<LabeledContent label="Expiration">
										<Text>Never</Text>
									</LabeledContent>
								)}
							</Section>
							{model.supportsRBAC ? (
								model.isPersonal ? (
									<Section header={<Text>Permissions</Text>}>
										<Label
											title="Personal keys inherit the assigned user's role permissions."
											systemImage="person.badge.key.fill"
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										/>
									</Section>
								) : model.manifest && model.metadata?.permissions !== undefined ? (
									<>
										<PermissionPicker
											manifest={model.manifest}
											selected={model.selectedPermissions}
											onSelectedChange={model.setSelectedPermissions}
											search={model.permissionSearch}
										/>
										<Section footer={<Text>{permissionsFooter}</Text>}>{null}</Section>
									</>
								) : (
									<Section header={<Text>Permissions</Text>}>
										{model.isLoadingPermissions ? (
											<ArcaneLoadingViewSwiftUI label="Loading permissions…" />
										) : (
											<PartialDataNotice message="Existing permissions will be preserved because they could not be loaded." />
										)}
									</Section>
								)
							) : null}
							<ErrorSection message={model.errorMessage} />
							<SettingsSaveBarSpacer />
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isSaving), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.canSave}
				onSave={model.save}
				onRevert={model.revertChanges}
				reservesTabBarSpace={false}
			/>
		</Sheet>
	);
}
