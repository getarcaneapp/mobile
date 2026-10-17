/** Android rendering of `StepUpAuthenticationSheet` (PasskeysMFAView.swift). */
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormSecureField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { M3Section, TextButtonRow } from '../shared/android-material';
import { ModalSheet } from './android-overlays';
import type { StepUpSheetProps } from './step-up-sheet.types';
import { useStepUpSheet } from './use-step-up-sheet';

function StepUpContent(props: StepUpSheetProps) {
	const sheet = useStepUpSheet(props);
	return (
		<View>
			<View
				style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 48 }}
			>
				<Pressable
					onPress={props.cancel}
					accessibilityRole="button"
					accessibilityLabel="Cancel"
					android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
					style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
				>
					<Icon name="xmark" size={24} color={m3.onSurfaceVariant} />
				</Pressable>
				<Text style={[m3Type.titleLarge, { color: colors.label, flex: 1, marginLeft: 8 }]}>
					Confirm Identity
				</Text>
				{sheet.isLoading ? <ActivityIndicator style={{ marginRight: 12 }} /> : null}
			</View>
			<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
				<Text
					style={[
						m3Type.bodyMedium,
						{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingTop: 8 }
					]}
				>
					Confirm your identity before changing account security settings.
				</Text>
				{props.allowsPassword ? (
					<M3Section title="Password">
						<FormSecureField
							title="Password"
							placeholder="Current password"
							text={sheet.password}
							onChangeText={sheet.setPassword}
							textContentType="password"
						/>
						<TextButtonRow
							title="Continue with Password"
							onPress={sheet.submitPassword}
							disabled={sheet.passwordDisabled}
						/>
					</M3Section>
				) : null}
				{props.allowsPasskey ? (
					<M3Section>
						<View
							style={{ opacity: sheet.isLoading ? 0.5 : 1 }}
							pointerEvents={sheet.isLoading ? 'none' : 'auto'}
						>
							<MaterialListItem
								headline="Continue with Passkey"
								icon="person.badge.key.fill"
								iconColor={m3.primary}
								onPress={sheet.submitPasskey}
							/>
						</View>
					</M3Section>
				) : null}
				{sheet.errorMessage ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.red} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
								{sheet.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
		</View>
	);
}

export function StepUpSheet(props: StepUpSheetProps) {
	return (
		<ModalSheet visible={props.isPresented} onDismiss={props.onDismissed}>
			{props.isPresented ? <StepUpContent {...props} /> : null}
		</ModalSheet>
	);
}
