import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { EnvironmentFilterSection } from '@/ui/components/environment-label';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, RadioGroup } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { ResourceUpdateFilters } from '@/features/containers/container-model';

import { ListSortOrders, ProjectStatusFilters, projectTagDisplayColor } from './project-model';
import { useProjectsFilterScreen } from './use-projects-filter-screen';

export function ProjectsFilterScreen() {
	const router = useRouter();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const { filter, update, toggleTag } = useProjectsFilterScreen(key);

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
						options={ListSortOrders.map((order) => ({
							value: order.id,
							title: order.title,
							icon: order.systemImage
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
				<M3Section title="Status">
					<RadioGroup
						options={ProjectStatusFilters.map((value) => ({ value, title: value }))}
						selection={filter.statusFilter}
						onSelect={(statusFilter) => update({ statusFilter })}
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
				{filter.tagOptions.length > 0 ? (
					<M3Section title="Tags">
						{filter.tagOptions.map((option) => {
							const selected = filter.tagFilter.includes(option.name);
							return (
								<Pressable
									key={option.name}
									onPress={() => toggleTag(option.name)}
									accessibilityRole="checkbox"
									accessibilityState={{ checked: selected }}
									android_ripple={{ color: colors.separator as string }}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 16,
										minHeight: 56,
										paddingHorizontal: 16
									}}
								>
									<Icon name="tag.fill" size={20} color={projectTagDisplayColor(option.color)} />
									<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
										{option.name}
									</Text>
									{selected ? (
										<Icon name="checkmark" size={20} color={m3.primary} />
									) : (
										<View style={{ width: 20 }} />
									)}
								</Pressable>
							);
						})}
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
