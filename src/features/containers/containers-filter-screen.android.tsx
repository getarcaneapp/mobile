import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';
import { EnvironmentFilterSection } from '@/ui/components/environment-label';

import {
	ContainerListSorts,
	ContainerStateFilters,
	ResourceUpdateFilters
} from './container-model';
import {
	useContainersFilter,
	useContainersFilterStore,
	type ContainersFilterState
} from './containers-filter-store';
import { AndroidToolbar } from './android-toolbar';
import { M3Section, M3TextField, RadioGroup, SwitchRow } from './android-material';

export function ContainersFilterScreen() {
	const router = useRouter();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const filter = useContainersFilter(key);
	const update = (patch: Partial<ContainersFilterState>) =>
		useContainersFilterStore.getState().update(key, patch);

	return (
		<>
			<Stack.Screen options={{ title: 'Filter' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'done',
						icon: 'checkmark',
						label: 'Done',
						onPress: () => router.back()
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Sort" footer="Live CPU and memory require Arcane 2.16 or later.">
					<RadioGroup
						options={ContainerListSorts.map((option) => ({
							value: option.id,
							title: option.title,
							icon: option.systemImage
						}))}
						selection={filter.sort}
						onSelect={(sort) => update({ sort })}
					/>
				</M3Section>
				<EnvironmentFilterSection
					environments={filter.environments}
					selection={filter.environmentFilter}
					onSelectionChange={(id) => update({ environmentFilter: id })}
				/>
				<M3Section title="State">
					<RadioGroup
						options={ContainerStateFilters.map((value) => ({ value, title: value }))}
						selection={filter.stateFilter}
						onSelect={(stateFilter) => update({ stateFilter })}
					/>
				</M3Section>
				<M3Section title="Updates">
					<RadioGroup
						options={ResourceUpdateFilters.map((option) => ({
							value: option.id,
							title: option.title
						}))}
						selection={filter.updateFilter}
						onSelect={(updateFilter) => update({ updateFilter })}
					/>
				</M3Section>
				<M3Section title="Visibility">
					<SwitchRow
						title="Show hidden"
						value={filter.showHidden}
						onValueChange={(showHidden) => update({ showHidden })}
					/>
					<M3TextField
						label="Label (key or key=value)"
						value={filter.labelFilter}
						onChangeText={(labelFilter) => update({ labelFilter })}
					/>
				</M3Section>
			</ScrollView>
		</>
	);
}
