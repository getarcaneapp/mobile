import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { biometryTitle } from '@/core/app-lock/app-lock-policy';
import { useAppLock } from '@/core/app-lock/app-lock-store';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

export function AppLockOverlay() {
	const isLocked = useAppLock((s) => s.isLocked);
	const isCovered = useAppLock((s) => s.isCovered);
	const isAuthenticating = useAppLock((s) => s.isAuthenticating);
	const biometry = useAppLock((s) => s.biometry);
	const unlock = useAppLock((s) => s.unlock);
	useEffect(() => {
		if (isLocked && router.canDismiss()) router.dismissAll();
	}, [isLocked]);
	if (!isLocked && !isCovered) return null;
	return (
		<View
			style={[
				StyleSheet.absoluteFill,
				{
					backgroundColor: colors.systemBackground,
					alignItems: 'center',
					justifyContent: 'center',
					gap: 16,
					padding: 32
				}
			]}
		>
			<Icon name="lock.fill" size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.headlineSmall, { color: colors.label }]}>Arcane is locked</Text>
			{isLocked ? (
				isAuthenticating ? (
					<ActivityIndicator color={m3.primary} style={{ marginTop: 8 }} />
				) : (
					<Pressable
						onPress={() => void unlock()}
						accessibilityRole="button"
						android_ripple={{ color: m3.onPrimary, borderless: false }}
						style={{
							marginTop: 8,
							height: 48,
							paddingHorizontal: 24,
							borderRadius: 24,
							overflow: 'hidden',
							flexDirection: 'row',
							alignItems: 'center',
							gap: 8,
							backgroundColor: m3.primary
						}}
					>
						<Icon name="lock.open.fill" size={18} color={m3.onPrimary} />
						<Text style={[m3Type.labelLarge, { color: m3.onPrimary }]}>
							{`Unlock with ${biometryTitle(biometry, 'android')}`}
						</Text>
					</Pressable>
				)
			) : null}
		</View>
	);
}
