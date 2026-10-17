/** Port of `FederatedCredentialFormView` (FederatedCredentialFormView.swift). */
import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	DatePicker,
	Form,
	LabeledContent,
	NavigationStack,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	disabled,
	font,
	foregroundStyle,
	keyboardType,
	multilineTextAlignment,
	navigationTitle,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { BoundTextField } from '../shared/swiftui-text-field';
import { useFederatedCredentialFormModel } from './use-federated-credential-form';

const plain = { autocapitalization: 'never', autocorrectionDisabled: true } as const;

export function FederatedCredentialFormScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useFederatedCredentialFormModel();
	const { form, update } = model;
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ gestureEnabled: !model.saving }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form modifiers={[navigationTitle(model.title), disabled(model.saving)]}>
							<Section title="Credential">
								<FormTextField
									title="Name"
									placeholder=""
									text={form.name}
									onChangeText={(name) => update({ name })}
									{...plain}
								/>
								<FormTextField
									title="Description"
									placeholder=""
									text={form.description}
									onChangeText={(description) => update({ description })}
									axis="vertical"
									{...plain}
								/>
								<Toggle
									label="Enabled"
									isOn={form.enabled}
									onIsOnChange={(enabled) => update({ enabled })}
								/>
							</Section>
							<Section
								title="Trust rule"
								modifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}
							>
								<FormTextField
									title="Issuer URL"
									placeholder=""
									text={form.issuerUrl}
									onChangeText={(issuerUrl) => update({ issuerUrl })}
									keyboardType="url"
									{...plain}
								/>
								<FormTextField
									title="Audiences, one per line"
									placeholder=""
									text={form.audiences}
									onChangeText={(audiences) => update({ audiences })}
									axis="vertical"
									{...plain}
								/>
								<FormTextField
									title="Subject claim"
									placeholder=""
									text={form.subjectClaim}
									onChangeText={(subjectClaim) => update({ subjectClaim })}
									{...plain}
								/>
								<FormPicker
									title="Match type"
									selection={form.matchType}
									onSelectionChange={(matchType) => update({ matchType })}
									options={[
										{ label: 'Exact', value: 'exact' },
										{ label: 'Glob', value: 'glob' }
									]}
								/>
								<FormTextField
									title="Subject match"
									placeholder=""
									text={form.subjectMatch}
									onChangeText={(subjectMatch) => update({ subjectMatch })}
									axis="vertical"
									{...plain}
								/>
							</Section>
							<Section
								header={<Text>Access</Text>}
								footer={
									model.expirationLocked ? (
										<Text>
											This server allows changing an expiration date but does not support removing
											it.
										</Text>
									) : undefined
								}
							>
								<FormPicker
									title="Role"
									selection={form.roleId}
									onSelectionChange={(roleId) => update({ roleId })}
									options={[
										{ label: 'Choose role', value: '' },
										...model.roles.map((role) => ({ label: role.name, value: role.id }))
									]}
								/>
								<FormPicker
									title="Environment"
									selection={form.environmentId}
									onSelectionChange={(environmentId) => update({ environmentId })}
									options={[
										{ label: 'Global', value: '' },
										...model.environments.map((environment) => ({
											label: environment.name ?? environment.id,
											value: environment.id
										}))
									]}
								/>
								<LabeledContent label="Token lifetime in seconds">
									<BoundTextField
										placeholder="Seconds"
										value={form.tokenTtlSeconds}
										onChangeText={(tokenTtlSeconds) => update({ tokenTtlSeconds })}
										modifiers={[keyboardType('numeric'), multilineTextAlignment('trailing')]}
									/>
								</LabeledContent>
								<Toggle
									label="Expires"
									isOn={form.expires}
									onIsOnChange={(expires) => update({ expires })}
									modifiers={[disabled(model.expirationLocked)]}
								/>
								{form.expires ? (
									<DatePicker
										title="Expiration"
										selection={form.expiresAt}
										displayedComponents={['date', 'hourAndMinute']}
										onDateChange={(expiresAt) => update({ expiresAt })}
									/>
								) : null}
							</Section>
							{model.errorMessage ? (
								<Section>
									<Text modifiers={[foregroundStyle(systemColors.red)]}>{model.errorMessage}</Text>
								</Section>
							) : null}
							{model.validationMessage ? (
								<Section>
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{model.validationMessage}
									</Text>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label={model.confirmTitle}
									onPress={model.save}
									modifiers={[disabled(model.confirmDisabled), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
