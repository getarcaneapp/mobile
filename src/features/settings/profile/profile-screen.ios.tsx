import { Host } from '@/ui/host';
import {
	Form,
	HStack,
	Label,
	LabeledContent,
	Section,
	Spacer,
	Text,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	background,
	font,
	foregroundStyle,
	padding,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { AppToolbar } from '@/ui/components/toolbar';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { UserAvatarCircle } from '@/ui/components/user-avatar';

import { NavLinkRow } from './nav-link-row';
import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';
import { useProfile, type ProfileModel } from './use-profile';

function Pill({ text, color }: { text: string; color: string }) {
	return (
		<Text
			modifiers={[
				font({ textStyle: 'caption2', weight: 'semibold' }),
				foregroundStyle('white'),
				padding({ horizontal: 7, vertical: 2 }),
				background(color, shapes.capsule())
			]}
		>
			{text}
		</Text>
	);
}

function IdentitySection({ model }: { model: ProfileModel }) {
	return (
		<Section>
			<HStack spacing={14} modifiers={[padding({ vertical: 4 }), accessibilityElement('combine')]}>
				<ZStack>
					<UserAvatarCircle size={56} />
				</ZStack>
				<VStack alignment="leading" spacing={3}>
					<Text modifiers={[font({ textStyle: 'headline' })]}>{model.headline}</Text>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{model.handle}
					</Text>
					<HStack spacing={6}>
						{model.isAdmin ? <Pill text="Admin" color={systemColors.indigo} /> : null}
						{model.isOIDCUser ? <Pill text="SSO" color={systemColors.teal} /> : null}
					</HStack>
				</VStack>
				<Spacer />
			</HStack>
		</Section>
	);
}

function PasswordSection({ model }: { model: ProfileModel }) {
	return (
		<Section title="Change Password" footer={<Text>{model.passwordFooter}</Text>}>
			<FormSecureField
				title="Current"
				placeholder="Current password"
				text={model.currentPassword}
				onChangeText={model.setCurrentPassword}
				textContentType="password"
			/>
			<FormSecureField
				title="New"
				placeholder="At least 8 characters"
				text={model.newPassword}
				onChangeText={model.setNewPassword}
				textContentType="newPassword"
			/>
			<FormSecureField
				title="Confirm"
				placeholder="Repeat new password"
				text={model.confirmPassword}
				onChangeText={model.setConfirmPassword}
				textContentType="newPassword"
			/>
		</Section>
	);
}

export function ProfileScreen() {
	const model = useProfile();

	return (
		<>
			<Stack.Screen options={{ title: 'Account', headerLargeTitleEnabled: false }} />
			<AppToolbar>
				<Stack.Toolbar.Menu
					icon="rectangle.portrait.and.arrow.right"
					tintColor={systemColors.red}
					accessibilityLabel="Sign Out options"
				>
					<Stack.Toolbar.MenuAction
						icon="rectangle.portrait.and.arrow.right"
						destructive
						onPress={() => model.requestSignOut('signOut')}
					>
						Sign Out
					</Stack.Toolbar.MenuAction>
					<Stack.Toolbar.MenuAction
						icon="link"
						destructive
						onPress={() => model.requestSignOut('signOutAndChangeServer')}
					>
						Sign Out & Change Server
					</Stack.Toolbar.MenuAction>
				</Stack.Toolbar.Menu>
			</AppToolbar>
			<View style={{ flex: 1 }}>
				<Host style={{ flex: 1 }}>
					<Form>
						<IdentitySection model={model} />

						<Section
							title="Profile"
							footer={
								model.isOIDCUser ? (
									<Text>Your profile is managed by your identity provider.</Text>
								) : undefined
							}
						>
							{model.isOIDCUser ? (
								<>
									<LabeledContent label="Display Name">
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											{model.readOnlyDisplayName}
										</Text>
									</LabeledContent>
									<LabeledContent label="Email">
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											{model.readOnlyEmail}
										</Text>
									</LabeledContent>
								</>
							) : (
								<>
									<FormTextField
										title="Display Name"
										placeholder="Your name"
										text={model.displayName}
										onChangeText={model.setDisplayName}
									/>
									<FormTextField
										title="Email"
										placeholder="you@example.com"
										text={model.email}
										onChangeText={model.setEmail}
										keyboardType="email-address"
										autocapitalization="never"
										autocorrectionDisabled
									/>
								</>
							)}
						</Section>

						{model.showsPreferences ? (
							<Section footer={<Text>Saved to your Arcane account.</Text>}>
								<NavLinkRow
									title="Preferences"
									systemImage="gearshape"
									onPress={model.openPreferences}
								/>
							</Section>
						) : null}

						{!model.isOIDCUser ? <PasswordSection model={model} /> : null}

						{model.showsSecurity ? (
							<Section title="Security">
								<NavLinkRow
									title="Passkeys & MFA"
									systemImage="person.badge.key.fill"
									onPress={model.openPasskeys}
								/>
							</Section>
						) : null}

						<Section
							title="Connections"
							footer={<Text>Saved servers and sign-ins for switching quickly.</Text>}
						>
							<NavLinkRow
								title="Connection Profiles"
								systemImage="person.crop.rectangle.stack.fill"
								onPress={model.openConnectionProfiles}
							/>
						</Section>

						<Section title="Language">
							<LabeledContent label="Language">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									English
								</Text>
							</LabeledContent>
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

						<SettingsSaveBarSpacer />
					</Form>
				</Host>
				<SettingsSaveBar
					hasChanges={model.hasChanges}
					isSaving={model.isSaving}
					canSave={model.canSave}
					onSave={model.save}
					onRevert={model.revertChanges}
				/>
			</View>
		</>
	);
}
