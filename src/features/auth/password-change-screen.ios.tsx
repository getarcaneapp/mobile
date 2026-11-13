import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	ProgressView,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';

import { systemColors } from '@/theme/colors';
import { FormSecureField } from '@/ui/components/form-fields';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';

import { usePasswordChange } from './use-password-change';

export function PasswordChangeScreen() {
	const model = usePasswordChange();
	const toolbarAccent = useAppAccentToolbarSymbol();
	const busy = model.isSaving || model.isSigningOut;

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[
							navigationTitle('Change Password'),
							navigationBarTitleDisplayMode('inline')
						]}
					>
						<Section
							footer={
								<Text>
									{model.hint ??
										(model.username
											? `Set a new password for ${model.username} to continue.`
											: 'Set a new password to continue.')}
								</Text>
							}
						>
							{model.passwordChanged ? (
								<Label
									title="Password changed"
									systemImage="checkmark.circle.fill"
									modifiers={[foregroundStyle(systemColors.green)]}
								/>
							) : (
								<>
									<FormSecureField
										title="Current"
										placeholder="Current password"
										text={model.currentPassword}
										onChangeText={model.setCurrentPassword}
										textContentType="password"
										disabled={busy}
									/>
									<FormSecureField
										title="New"
										placeholder={model.newPasswordPlaceholder}
										text={model.newPassword}
										onChangeText={model.setNewPassword}
										textContentType="newPassword"
										disabled={busy}
									/>
									<FormSecureField
										title="Confirm"
										placeholder="Repeat new password"
										text={model.confirmPassword}
										onChangeText={model.setConfirmPassword}
										textContentType="newPassword"
										disabled={busy}
									/>
								</>
							)}
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

						<Section>
							<Button role="destructive" onPress={model.signOut} modifiers={[disabled(busy)]}>
								<Label title="Sign Out" systemImage="rectangle.portrait.and.arrow.right" />
							</Button>
						</Section>
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="confirmationAction">
							{model.isSaving ? (
								<ProgressView />
							) : (
								<Button
									label={model.passwordChanged ? 'Continue' : 'Save'}
									onPress={model.submit}
									modifiers={[...toolbarAccent, disabled(!model.canSubmit)]}
								/>
							)}
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
