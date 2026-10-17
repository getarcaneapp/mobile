import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { MaterialListItem } from '@/ui/material/list';
import { ToastHost } from '@/ui/toast';

import { M3Section } from '../shared/android-material';
import { useRecoveryCodes } from './use-recovery-codes';

export function RecoveryCodesScreen() {
	const model = useRecoveryCodes();
	const insets = useSafeAreaInsets();

	useEffect(() => {
		const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
		return () => subscription.remove();
	}, []);

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen
				options={{ title: 'Save Recovery Codes', headerBackVisible: false, gestureEnabled: false }}
			/>
			<ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
				<M3Section>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, padding: 16 }]}>
						Save these codes somewhere secure. They will not be shown again.
					</Text>
				</M3Section>
				<M3Section title="Recovery Codes">
					{model.codes.map((code) => (
						<Text
							key={code}
							selectable
							style={[
								m3Type.bodyLarge,
								{
									color: colors.label,
									fontFamily: monoFamily,
									paddingHorizontal: 16,
									paddingVertical: 12
								}
							]}
						>
							{code}
						</Text>
					))}
				</M3Section>
				<M3Section>
					<MaterialListItem
						headline="Copy All Codes"
						icon="doc.on.doc"
						iconColor={m3.primary}
						onPress={model.copyAll}
					/>
				</M3Section>
			</ScrollView>
			<View
				style={{
					padding: 16,
					paddingBottom: 16 + insets.bottom,
					backgroundColor: m3.surfaceContainerHigh
				}}
			>
				<Pressable
					onPress={model.confirmSaved}
					accessibilityRole="button"
					android_ripple={{ color: colors.separator as string }}
					style={{
						height: 48,
						borderRadius: 24,
						overflow: 'hidden',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: m3.primary
					}}
				>
					<Text style={[m3Type.labelLarge, { color: m3.onPrimary }]}>
						{"I've Saved These Codes"}
					</Text>
				</Pressable>
			</View>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
