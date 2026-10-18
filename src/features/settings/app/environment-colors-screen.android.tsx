import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { MaterialSheet } from '@/features/dashboard/components/material-sheet';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import { colors } from '@/theme/colors';
import { AccentColorMenu, CustomAccentColorPicker } from '@/ui/components/accent-color-menu';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section, TextButtonRow } from '../shared/android-material';
import { LongPressMenu } from '../shared/long-press-menu';
import {
	EnvironmentColorsCopy,
	useEnvironmentColor,
	useEnvironmentColors
} from './use-environment-colors';

function EnvironmentColorPicker({
	environment,
	onReset
}: {
	environment: Environment;
	onReset: () => void;
}) {
	const model = useEnvironmentColor(environment);
	const [showCustomColor, setShowCustomColor] = useState(false);
	return (
		<>
			<LongPressMenu
				title={model.name}
				items={[{ id: 'reset', title: 'Reset', onPress: onReset }]}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 16,
					minHeight: 56,
					paddingHorizontal: 16
				}}
			>
				<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{model.name}</Text>
				<AccentColorMenu
					selection={model.selectedHex}
					onSelectionChange={model.save}
					isAvailable={model.isAvailable}
					onCustom={() => setShowCustomColor(true)}
					unnamedTitle={model.unnamedTitle}
					accessibilityLabel={`${model.name} color`}
				/>
			</LongPressMenu>
			<MaterialSheet isPresented={showCustomColor} onDismiss={() => setShowCustomColor(false)}>
				<CustomAccentColorPicker selection={model.selectedHex} onSelectionChange={model.save} />
			</MaterialSheet>
		</>
	);
}

export function EnvironmentColorsScreen() {
	const model = useEnvironmentColors();
	return (
		<>
			<Stack.Screen options={{ title: 'Environment Colors' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section footer={EnvironmentColorsCopy.androidFooter}>
					{model.environments.map((environment) => (
						<EnvironmentColorPicker
							key={environment.id}
							environment={environment}
							onReset={() => model.reset(environment)}
						/>
					))}
				</M3Section>
				{model.errorMessage ? (
					<M3Section>
						<Text
							style={[
								m3Type.bodyMedium,
								{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingVertical: 12 }
							]}
						>
							{model.errorMessage}
						</Text>
						<TextButtonRow title="Retry" onPress={model.retry} />
					</M3Section>
				) : null}
			</ScrollView>
			{model.showsLoading ? (
				<View
					pointerEvents="none"
					style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
				>
					<ArcaneLoadingView />
				</View>
			) : null}
		</>
	);
}
