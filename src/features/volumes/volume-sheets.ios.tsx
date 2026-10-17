/**
 * Ports of `CreateVolumeView` (VolumesView.swift) and the volume flavour of
 * `RenameContainerSheet` (RenameContainerSheet.swift, `resourceKind: "Volume"`,
 * `footer: VolumeRename.footer`).
 */
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	font,
	foregroundStyle,
	interactiveDismissDisabled,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';

import { useCreateVolume, useRenameVolume, type DriverMode } from './use-volume-sheets';
import { VolumeRename } from './volume-model';

export function CreateVolumeScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useCreateVolume(envID);
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[navigationTitle('Create Volume'), navigationBarTitleDisplayMode('inline')]}
					>
						<Section title="Volume Details">
							<FormTextField
								title="Name"
								placeholder="app-data"
								text={model.name}
								onChangeText={model.setName}
								autocapitalization="never"
								autocorrectionDisabled
								helper="Use a stable name so containers can mount this volume later."
							/>
							<FormPicker<DriverMode>
								title="Driver"
								selection={model.driverMode}
								onSelectionChange={model.setDriverMode}
								options={[
									{ label: 'Local', value: 'local' },
									{ label: 'Custom driver', value: 'custom' }
								]}
								helper={model.driverHelper}
							/>
							{model.driverMode === 'custom' ? (
								<FormTextField
									title="Custom Driver"
									placeholder="driver-name"
									text={model.customDriver}
									onChangeText={model.setCustomDriver}
									autocapitalization="never"
									autocorrectionDisabled
								/>
							) : null}
						</Section>
						{model.errorMessage ? (
							<Section>
								<Label
									title={model.errorMessage}
									systemImage="exclamationmark.triangle"
									modifiers={[foregroundStyle(systemColors.red)]}
								/>
							</Section>
						) : null}
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Create"
								onPress={model.create}
								modifiers={[disabled(!model.canCreate), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

export function RenameVolumeScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const {
		name = '',
		envID = '0',
		popsDetail
	} = useLocalSearchParams<{
		name?: string;
		envID?: string;
		popsDetail?: string;
	}>();
	const model = useRenameVolume(envID, name, popsDetail === '1');
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !model.isSubmitting }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Rename Volume'),
								navigationBarTitleDisplayMode('inline'),
								interactiveDismissDisabled(model.isSubmitting)
							]}
						>
							<Section header={<Text>New name</Text>} footer={<Text>{VolumeRename.footer}</Text>}>
								<FormTextField
									title="Volume Name"
									placeholder={name}
									text={model.newName}
									onChangeText={model.setNewName}
									autocapitalization="never"
									autocorrectionDisabled
									helper="Must start with a letter or digit, and contain only letters, digits, underscores, dots, or hyphens."
								/>
							</Section>
							{model.errorMessage ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="topBarLeading">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isSubmitting), ...toolbarSymbol]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="topBarTrailing">
								<Button
									label="Save"
									onPress={model.submit}
									modifiers={[disabled(!model.canSave), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}
