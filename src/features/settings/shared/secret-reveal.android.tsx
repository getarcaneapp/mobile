/**
 * Material rendering of `NewAPIKeyView` / `NewWebhookTokenView`: the one-time
 * secret with a filled copy button; Done sits in the top app bar.
 */
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { showToast, Toasts } from '@/ui/toast';

import { AndroidToolbar } from './android-toolbar';
import type { SecretRevealProps } from './secret-reveal.types';

export function SecretRevealScreen(props: SecretRevealProps) {
	const { secret, secretCaption, fullWidthSecret = false, warning } = props;
	const copy = () => {
		void Clipboard.setStringAsync(secret);
		showToast(Toasts.copied(props.copiedToast));
	};
	return (
		<>
			<Stack.Screen options={{ title: props.navigationTitle }} />
			<AndroidToolbar
				items={[
					{ kind: 'button', id: 'done', icon: 'checkmark', label: 'Done', onPress: props.onDone }
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ alignItems: 'center', gap: 24, paddingTop: 32, paddingBottom: 24 }}
			>
				<View
					style={{
						width: 96,
						height: 96,
						borderRadius: 48,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: colors.secondarySystemGroupedBackground
					}}
				>
					<Icon name={props.systemImage} size={48} color={props.iconColor} />
				</View>
				<Text
					style={[
						m3Type.headlineSmall,
						{ color: colors.label, fontWeight: '700', textAlign: 'center' }
					]}
				>
					{props.heading}
				</Text>
				<Text
					style={[
						m3Type.bodyLarge,
						{ color: colors.secondaryLabel, textAlign: 'center', paddingHorizontal: 32 }
					]}
				>
					{props.message}
				</Text>
				<View
					style={{
						alignSelf: fullWidthSecret ? 'stretch' : 'center',
						marginHorizontal: 24,
						padding: 16,
						gap: 4,
						borderRadius: Radius.nested,
						backgroundColor: colors.secondarySystemGroupedBackground
					}}
				>
					{secretCaption !== undefined ? (
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							{secretCaption}
						</Text>
					) : null}
					<Text
						selectable
						style={[m3Type.bodySmall, { color: colors.label, fontFamily: monoFamily }]}
					>
						{secret}
					</Text>
				</View>
				{warning ? (
					<View
						style={{
							alignSelf: 'stretch',
							marginHorizontal: 24,
							padding: 14,
							flexDirection: 'row',
							gap: 8,
							borderRadius: Radius.nested,
							backgroundColor: withOpacity(systemColors.orange, 0.12)
						}}
					>
						<Icon name="exclamationmark.triangle.fill" size={18} color={systemColors.orange} />
						<Text style={[m3Type.bodyMedium, { color: systemColors.orange, flex: 1 }]}>
							{warning}
						</Text>
					</View>
				) : null}
				<Pressable
					onPress={copy}
					accessibilityRole="button"
					android_ripple={{ color: m3.onPrimary as string }}
					style={{
						alignSelf: 'stretch',
						marginHorizontal: 24,
						minHeight: 52,
						borderRadius: 26,
						flexDirection: 'row',
						gap: 8,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: m3.primary,
						overflow: 'hidden'
					}}
				>
					<Icon name="doc.on.clipboard" size={18} color={m3.onPrimary} />
					<Text style={[m3Type.labelLarge, { color: m3.onPrimary }]}>Copy to Clipboard</Text>
				</Pressable>
			</ScrollView>
		</>
	);
}
