/** Android renderings of the Environment / Labels / Mounts / Health History pages. */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { ParsedEnvironmentVariable } from '@/core/environment-secret-detector';
import { colors, systemColors } from '@/theme/colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { M3Section, ValueRow } from './android-material';
import { formattedHealthDate, mountRows } from './container-detail-logic';
import {
	sortedLabelKeys,
	useCachedDetails,
	useEnvironmentVariables
} from './use-container-subpages';

const Separator = () => (
	<View style={{ height: 0.5, marginLeft: 16, backgroundColor: colors.separator }} />
);

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

export function EnvVarsScreen() {
	const details = useCachedDetails();
	const { displayedEntries, setSearchText, revealReset } = useEnvironmentVariables(
		details?.config.env ?? []
	);
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
			>
				<MaterialListGroup>
					{displayedEntries.map((entry, index) => (
						<View key={entry.id}>
							{index > 0 ? <Separator /> : null}
							<VariableRow variable={entry.variable} revealReset={revealReset} />
						</View>
					))}
				</MaterialListGroup>
			</ScrollView>
		</>
	);
}

export function LabelsScreen() {
	const labels = useCachedDetails()?.labels ?? {};
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

export function MountsScreen() {
	const mounts = useCachedDetails()?.mounts ?? [];
	return (
		<>
			<Stack.Screen options={{ title: 'Mounts' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				{mounts.map((mount, index) => (
					<M3Section key={index}>
						{mountRows(mount).map((row) => (
							<ValueRow
								key={row.title}
								title={row.title}
								value={row.value}
								monospaced={row.monospaced}
							/>
						))}
					</M3Section>
				))}
			</ScrollView>
		</>
	);
}

export function HealthHistoryScreen() {
	const log = useCachedDetails()?.state.health?.log ?? [];
	return (
		<>
			<Stack.Screen options={{ title: 'Health History' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
			>
				<MaterialListGroup>
					{log.map((entry, index) => (
						<View key={index} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
							{index > 0 ? <Separator /> : null}
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
								<Text style={[m3Type.labelMedium, { color: colors.label }]}>
									{entry.start ? formattedHealthDate(entry.start) : '—'}
								</Text>
								{entry.end ? (
									<Text
										style={[m3Type.bodySmall, { color: colors.secondaryLabel, flex: 1 }]}
									>{`→ ${formattedHealthDate(entry.end)}`}</Text>
								) : (
									<View style={{ flex: 1 }} />
								)}
								<Text
									style={{
										fontFamily: monoFamily,
										fontSize: 12,
										color: entry.exitCode === 0 ? systemColors.green : systemColors.red
									}}
								>
									{`exit ${entry.exitCode}`}
								</Text>
							</View>
							{entry.output ? (
								<Text
									selectable
									style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label }}
								>
									{entry.output.trim()}
								</Text>
							) : null}
						</View>
					))}
				</MaterialListGroup>
			</ScrollView>
		</>
	);
}
