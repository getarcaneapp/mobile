import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, systemColors, withOpacity } from '@/theme/colors';
import { ErrorBanner } from '@/ui/components/error-banner';
import { FormSecureField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { usePasswordChange } from './use-password-change';

export function PasswordChangeScreen() {
	const model = usePasswordChange();
	const busy = model.isSaving || model.isSigningOut;
	const submitDisabled = !model.canSubmit;
	const content = submitDisabled
		? withOpacity(colors.label as string, 0.38)
		: (m3.onPrimary as string);

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			edges={['top', 'bottom']}
		>
			<View style={{ height: 64, justifyContent: 'center', paddingHorizontal: 16 }}>
				<Text style={[m3Type.titleLarge, { color: colors.label }]} accessibilityRole="header">
					Change Password
				</Text>
			</View>
			<KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
				<ScrollView
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="interactive"
					contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
				>
					<View>
						<View style={{ height: 12 }} />
						<MaterialListGroup>
							{model.passwordChanged ? (
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}>
									<Icon name="checkmark.circle.fill" size={24} color={systemColors.green} />
									<Text style={[m3Type.bodyLarge, { color: colors.label }]}>Password changed</Text>
								</View>
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
						</MaterialListGroup>
						<Text
							style={[
								m3Type.bodySmall,
								{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
							]}
						>
							{model.hint ??
								(model.username
									? `Set a new password for ${model.username} to continue.`
									: 'Set a new password to continue.')}
						</Text>
					</View>

					{model.errorMessage ? (
						<View style={{ paddingHorizontal: 16 }}>
							<ErrorBanner message={model.errorMessage} />
						</View>
					) : null}

					<View style={{ paddingHorizontal: 16, gap: 8 }}>
						<Pressable
							onPress={model.submit}
							disabled={submitDisabled}
							accessibilityRole="button"
							accessibilityLabel={model.submitTitle}
							accessibilityState={{ disabled: submitDisabled, busy: model.isSaving }}
							android_ripple={{ color: withOpacity(m3.onPrimary as string, 0.16) }}
							style={{
								minHeight: 56,
								borderRadius: 28,
								overflow: 'hidden',
								alignItems: 'center',
								justifyContent: 'center',
								paddingHorizontal: 20,
								backgroundColor: submitDisabled
									? withOpacity(colors.label as string, 0.12)
									: (m3.primary as string)
							}}
						>
							{model.isSaving ? (
								<ActivityIndicator color={m3.onPrimary as string} />
							) : (
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
									<Icon name="key.fill" size={20} color={content} />
									<Text style={[m3Type.labelLarge, { fontSize: 16, color: content }]}>
										{model.submitTitle}
									</Text>
								</View>
							)}
						</Pressable>
						<Pressable
							onPress={model.signOut}
							disabled={busy}
							accessibilityRole="button"
							accessibilityState={{ disabled: busy, busy: model.isSigningOut }}
							android_ripple={{ color: withOpacity(m3.error as string, 0.12) }}
							style={{
								alignSelf: 'center',
								minHeight: 48,
								paddingHorizontal: 16,
								borderRadius: 24,
								overflow: 'hidden',
								flexDirection: 'row',
								alignItems: 'center',
								gap: 8,
								opacity: busy ? 0.38 : 1
							}}
						>
							<Icon
								name="rectangle.portrait.and.arrow.right"
								size={18}
								color={m3.error as string}
							/>
							<Text style={[m3Type.labelLarge, { fontSize: 16, color: m3.error }]}>Sign Out</Text>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}
