import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { M3Section, RadioGroup, SwitchRow } from '@/features/containers/android-material';
import { colors } from '@/theme/colors';
import { EnvironmentFilterSection } from '@/ui/components/environment-label';
import { m3Type } from '@/ui/components/type-scale';

import { securityFilterActions, useSecurityFilter } from './security-filter-store';
import { SeverityBadge } from './vulnerability-rows';
import { severityDisplayLabel, VulnerabilitySeverities } from './vulnerability-model';
import { M3Switch } from '@/ui/material/switch';

const allImagesTag = '__all_images__';

export function SecurityFilterScreen() {
	const router = useRouter();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const filter = useSecurityFilter(key);
	const actions = securityFilterActions(key);

	return (
		<>
			<Stack.Screen options={{ title: 'Filters' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'reset',
						icon: 'arrow.counterclockwise',
						label: 'Reset',
						onPress: actions.reset
					},
					{
						kind: 'button',
						id: 'done',
						icon: 'checkmark',
						label: 'Done',
						onPress: () => {
							actions.done();
							router.back();
						}
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<EnvironmentFilterSection
					environments={filter.environments}
					selection={filter.environmentFilter}
					onSelectionChange={(id) => actions.update({ environmentFilter: id })}
				/>
				<M3Section title="Severity">
					{VulnerabilitySeverities.map((severity) => {
						const isOn = filter.selectedSeverities.includes(severity);
						return (
							<View
								key={severity}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 16,
									minHeight: 56,
									paddingHorizontal: 16
								}}
							>
								<SeverityBadge severity={severity} />
								<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
									{severityDisplayLabel(severity)}
								</Text>
								<M3Switch
									value={isOn}
									onValueChange={(value) => actions.toggleSeverity(severity, value)}
									accessibilityLabel={severityDisplayLabel(severity)}
								/>
							</View>
						);
					})}
				</M3Section>
				{filter.imageOptions.length > 0 ? (
					<M3Section title="Image">
						<RadioGroup
							options={[
								{ value: allImagesTag, title: 'All' },
								...filter.imageOptions.map((name) => ({ value: name, title: name }))
							]}
							selection={filter.selectedImage ?? allImagesTag}
							onSelect={(value) =>
								actions.update({ selectedImage: value === allImagesTag ? undefined : value })
							}
						/>
					</M3Section>
				) : null}
				<M3Section title="Options">
					<SwitchRow
						title="Only with fix available"
						value={filter.onlyFixAvailable}
						onValueChange={(value) => actions.update({ onlyFixAvailable: value })}
					/>
				</M3Section>
			</ScrollView>
		</>
	);
}
