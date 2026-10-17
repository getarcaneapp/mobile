/** Android rendering of NetworksView's Filter sheet. */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

import { ListSortOrder } from '@/core/list-sort-order';
import { colors } from '@/theme/colors';
import { EnvironmentFilterSection } from '@/ui/components/environment-label';

import { M3Section, RadioGroup } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { NetworkTypeFilters } from './network-model';
import {
	useNetworksFilter,
	useNetworksFilterStore,
	type NetworksFilterState
} from './networks-filter-store';

export function NetworksFilterScreen() {
	const router = useRouter();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const filter = useNetworksFilter(key);
	const update = (patch: Partial<NetworksFilterState>) =>
		useNetworksFilterStore.getState().update(key, patch);

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
			>
				<M3Section title="Sort">
					<RadioGroup
						options={ListSortOrder.allCases.map((order) => ({
							value: order,
							title: ListSortOrder.title(order),
							icon: ListSortOrder.systemImage(order)
						}))}
						selection={filter.sortOrder}
						onSelect={(sortOrder) => update({ sortOrder })}
					/>
				</M3Section>
				<EnvironmentFilterSection
					environments={filter.environments}
					selection={filter.environmentFilter}
					onSelectionChange={(id) => update({ environmentFilter: id })}
				/>
				<M3Section title="Type">
					<RadioGroup
						options={NetworkTypeFilters.map((value) => ({ value, title: value }))}
						selection={filter.typeFilter}
						onSelect={(typeFilter) => update({ typeFilter })}
					/>
				</M3Section>
			</ScrollView>
		</>
	);
}
