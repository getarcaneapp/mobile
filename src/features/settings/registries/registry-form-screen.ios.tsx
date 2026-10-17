import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	NavigationStack,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	animation,
	autocorrectionDisabled,
	buttonStyle,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { FormPicker, FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { swiftAnimation } from '@/ui/components/swiftui-motion';
import { ToastHost } from '@/ui/toast';

import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';
import { BoundTextField } from '../shared/swiftui-text-field';

import { useRegistryForm } from './use-registry-form';

export function RegistryFormScreen() {
	const model = useRegistryForm();
	const { draft, update } = model;

	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								animation(swiftAnimation(Motion.entrance), model.isAWS),
								navigationTitle(model.title),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section
								header={<Text>Registry Details</Text>}
								footer={<Text>Choose AWS ECR only for registries that need AWS credentials.</Text>}
							>
								<FormTextField
									title="Registry URL"
									placeholder="registry.example.com"
									text={draft.url}
									onChangeText={(url) => update({ url })}
									keyboardType="url"
									textContentType="URL"
									autocapitalization="never"
									autocorrectionDisabled
								/>
								<FormTextField
									title="Description"
									placeholder="Optional"
									text={draft.description}
									onChangeText={(description) => update({ description })}
									axis="vertical"
									lineLimit={{ min: 2, max: 4 }}
								/>
								<FormPicker
									title="Type"
									selection={model.typeSelection}
									onSelectionChange={model.setType}
									options={[
										{ label: 'Generic', value: 'generic' },
										{ label: 'AWS ECR', value: 'ecr' }
									]}
								/>
								<Toggle
									label="Enabled"
									isOn={draft.enabled}
									onIsOnChange={(enabled) => update({ enabled })}
								/>
								<Toggle
									label="Insecure"
									isOn={draft.insecure}
									onIsOnChange={(insecure) => update({ insecure })}
								/>
							</Section>

							{!model.isAWS ? (
								<Section title="Credentials (optional)">
									<FormTextField
										title="Username"
										placeholder="Optional"
										text={draft.username}
										onChangeText={(username) => update({ username })}
										autocapitalization="never"
										autocorrectionDisabled
									/>
									<FormSecureField
										title={model.isEditing ? 'New Token or Password' : 'Token or Password'}
										placeholder={model.isEditing ? 'Leave blank to keep current value' : 'Optional'}
										text={draft.token}
										onChangeText={(token) => update({ token })}
									/>
								</Section>
							) : (
								<Section title="AWS ECR">
									<FormTextField
										title="Access Key ID"
										placeholder="AKIA..."
										text={draft.awsAccessKeyId}
										onChangeText={(awsAccessKeyId) => update({ awsAccessKeyId })}
										autocapitalization="never"
										autocorrectionDisabled
									/>
									<FormSecureField
										title={model.isEditing ? 'New Secret Access Key' : 'Secret Access Key'}
										placeholder={model.isEditing ? 'Leave blank to keep current value' : 'Required'}
										text={draft.awsSecretAccessKey}
										onChangeText={(awsSecretAccessKey) => update({ awsSecretAccessKey })}
									/>
									<FormTextField
										title="Region"
										placeholder="us-east-1"
										text={draft.awsRegion}
										onChangeText={(awsRegion) => update({ awsRegion })}
										autocapitalization="never"
										autocorrectionDisabled
									/>
								</Section>
							)}

							{model.supportsPost26 ? (
								<Section
									header={<Text>Repository Names</Text>}
									footer={
										<Text>Limit registry checks to these repositories, in the order shown.</Text>
									}
								>
									{draft.repositoryNameRows.map((row) => (
										<HStack key={row.id}>
											<BoundTextField
												placeholder="owner/image"
												value={row.value}
												onChangeText={(value) => model.updateRepositoryRow(row.id, value)}
												modifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}
											/>
											<Button
												role="destructive"
												onPress={() => model.removeRepositoryRow(row.id)}
												modifiers={[
													buttonStyle('borderless'),
													accessibilityLabel('Remove repository name')
												]}
											>
												<Image
													systemName="minus.circle.fill"
													modifiers={[foregroundStyle(systemColors.red)]}
												/>
											</Button>
										</HStack>
									))}
									<Button onPress={model.addRepositoryRow}>
										<Label title="Add Repository Name" systemImage="plus" />
									</Button>
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
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isLoading}
				canSave={model.canSave}
				saveAccessibilityLabel={model.saveAccessibilityLabel}
				onSave={model.save}
				onRevert={model.revertChanges}
				reservesTabBarSpace={false}
			/>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
