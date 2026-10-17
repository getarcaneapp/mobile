/** Android renderings of the swarm service Environment / Labels pages. */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { ParsedEnvironmentVariable } from '@/core/environment-secret-detector';
import { colors, systemColors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { ValueRow } from '@/features/containers/android-material';
import {
	sortedLabelKeys,
	useEnvironmentVariables
} from '@/features/containers/use-container-subpages';

import { useServiceLabels, useServiceVars } from './use-swarm-service-subpages';

function VariableRow({
	variable,
	revealReset
}: {
	variable: ParsedEnvironmentVariable;
	revealReset: number;
}) {
	const [isRevealed, setIsRevealed] = useState(false);
	useEffect(() => setIsRevealed(false), [revealReset]);
	if (variable.value === undefined || variable.name === '' || variable.value === '') {
		return (
			<Text selectable style={[m3Type.bodySmall, { color: colors.label, padding: 16 }]}>
				{variable.rawValue}
			</Text>
		);
	}
	const hides = variable.isPotentialSecret && !isRevealed;
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 5 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<Text style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}>{variable.name}</Text>
				{variable.isPotentialSecret ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
						<Icon name="lock.fill" size={11} color={systemColors.orange} />
						<Text style={[m3Type.labelSmall, { color: systemColors.orange }]}>
							Potential secret
						</Text>
					</View>
				) : null}
			</View>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Text
					selectable={!hides}
					accessibilityLabel={hides ? 'Potential secret hidden' : variable.value}
					style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
				>
					{hides ? '••••••••••••' : variable.value}
				</Text>
				{variable.isPotentialSecret ? (
					<Pressable
						onPress={() => setIsRevealed((value) => !value)}
						accessibilityRole="button"
						accessibilityLabel={
							isRevealed ? `Hide value for ${variable.name}` : `Reveal value for ${variable.name}`
						}
						style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
					>
						<Icon name={isRevealed ? 'eye.slash' : 'eye'} size={18} color={colors.secondaryLabel} />
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

export function SwarmServiceEnvScreen() {
	const vars = useServiceVars();
	const { displayedEntries, setSearchText, revealReset } = useEnvironmentVariables(vars);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Environment Variables',
					headerSearchBarOptions: {
						onChangeText: (event) => setSearchText(event.nativeEvent.text),
						onClose: () => setSearchText('')
					}
				}}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
				contentInsetAdjustmentBehavior="automatic"
			>
				<MaterialListGroup>
					{displayedEntries.map((entry) => (
						<VariableRow key={entry.id} variable={entry.variable} revealReset={revealReset} />
					))}
				</MaterialListGroup>
			</ScrollView>
		</>
	);
}

export function SwarmServiceLabelsScreen() {
	const labels = useServiceLabels();
	return (
		<>
			<Stack.Screen options={{ title: 'Labels' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
			>
				<MaterialListGroup>
					{sortedLabelKeys(labels).map((key) => (
						<ValueRow key={key} title={key} value={labels[key] ?? ''} />
					))}
				</MaterialListGroup>
			</ScrollView>
		</>
	);
}
