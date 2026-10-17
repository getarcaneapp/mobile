/** Android rendering of ImagesView's Filter sheet. */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

import { M3Section, RadioGroup } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { ListSortOrder } from '@/core/list-sort-order';
import { colors } from '@/theme/colors';
import { EnvironmentFilterSection } from '@/ui/components/environment-label';

import { ImageTagsFilters } from './image-model';
import {
	useImagesFilter,
	useImagesFilterStore,
	type ImagesFilterState
} from './images-filter-store';

export function ImagesFilterScreen() {
	const router = useRouter();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const filter = useImagesFilter(key);
	const update = (patch: Partial<ImagesFilterState>) =>
		useImagesFilterStore.getState().update(key, patch);

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
				<M3Section title="Tags">
					<RadioGroup
						options={ImageTagsFilters.map((value) => ({ value, title: value }))}
						selection={filter.tagsFilter}
						onSelect={(tagsFilter) => update({ tagsFilter })}
					/>
				</M3Section>
			</ScrollView>
		</>
	);
}
