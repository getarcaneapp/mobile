/** Android rendering of `ProfileView` (Views/Settings/ProfileView.swift). */
import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';
import { UserAvatarCircle } from '@/ui/components/user-avatar';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { M3Section, ValueRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import {
	SettingsSaveBar,
	settingsSaveBarHeight as saveBarHeight
} from '../shared/settings-save-bar';
import { useProfile } from './use-profile';

function Pill({ text, color }: { text: string; color: string }) {
	return (
		<View
			style={{
				backgroundColor: color,
				borderRadius: 999,
				paddingHorizontal: 8,
				paddingVertical: 2
			}}
		>
			<Text style={[m3Type.labelSmall, { color: '#FFFFFF' }]}>{text}</Text>
		</View>
	);
}

export function ProfileScreen() {
	const model = useProfile();

	return (
		<>
			<Stack.Screen options={{ title: 'Account' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'menu',
						id: 'sign-out',
						icon: 'rectangle.portrait.and.arrow.right',
						label: 'Sign Out options',
						items: [
							{
								id: 'signOut',
								title: 'Sign Out',
								destructive: true,
								onPress: () => model.requestSignOut('signOut')
							},
							{
								id: 'signOutAndChangeServer',
								title: 'Sign Out & Change Server',
								destructive: true,
								onPress: () => model.requestSignOut('signOutAndChangeServer')
							}
						]
					}
				]}
			/>
			<View style={{ flex: 1 }}>
				<ScrollView
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingBottom: saveBarHeight + 24 }}
					keyboardShouldPersistTaps="handled"
				>
					<M3Section>
						<View
							accessible
							accessibilityLabel={`${model.headline}, ${model.handle}`}
							style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}
						>
							<UserAvatarCircle size={56} />
							<View style={{ flex: 1, gap: 3 }}>
								<Text style={[m3Type.titleMedium, { color: colors.label }]}>{model.headline}</Text>
								<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
									{model.handle}
								</Text>
								{model.isAdmin || model.isOIDCUser ? (
									<View style={{ flexDirection: 'row', gap: 6 }}>
										{model.isAdmin ? <Pill text="Admin" color={systemColors.indigo} /> : null}
										{model.isOIDCUser ? <Pill text="SSO" color={systemColors.teal} /> : null}
									</View>
								) : null}
							</View>
						</View>
					</M3Section>

					<M3Section
						title="Profile"
						footer={
							model.isOIDCUser ? 'Your profile is managed by your identity provider.' : undefined
						}
					>
						{model.isOIDCUser ? (
							<>
								<ValueRow title="Display Name" value={model.readOnlyDisplayName} />
								<ValueRow title="Email" value={model.readOnlyEmail} />
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
					</M3Section>

					{model.showsPreferences ? (
						<M3Section footer="Saved to your Arcane account.">
							<MaterialListItem
								headline="Preferences"
								icon="gearshape"
								onPress={model.openPreferences}
							/>
						</M3Section>
					) : null}

					{!model.isOIDCUser ? (
						<M3Section title="Change Password" footer={model.passwordFooter}>
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
						</M3Section>
					) : null}

					{model.showsSecurity ? (
						<M3Section title="Security">
							<MaterialListItem
								headline="Passkeys & MFA"
								icon="person.badge.key.fill"
								onPress={model.openPasskeys}
							/>
						</M3Section>
					) : null}

					<M3Section title="Connections" footer="Saved servers and sign-ins for switching quickly.">
						<MaterialListItem
							headline="Connection Profiles"
							icon="person.crop.rectangle.stack.fill"
							onPress={model.openConnectionProfiles}
						/>
					</M3Section>

					<M3Section title="Language" footer="Language selection is coming in a future update.">
						<ValueRow title="Language" value="English" selectable={false} />
					</M3Section>

					{model.errorMessage ? (
						<M3Section>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
								<Icon name="exclamationmark.triangle" size={20} color={systemColors.red} />
								<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
									{model.errorMessage}
								</Text>
							</View>
						</M3Section>
					) : null}
				</ScrollView>
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
