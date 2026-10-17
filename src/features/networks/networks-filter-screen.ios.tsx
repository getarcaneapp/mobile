/** NetworksView's Filter sheet: sort, environment, and type for the list that opened it. */
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	Picker,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	labelsHidden,
	navigationBarTitleDisplayMode,
	navigationTitle,
	pickerStyle,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import type { SFSymbol } from 'sf-symbols-typescript';

import { ListSortOrder } from '@/core/list-sort-order';
import { EnvironmentFilterSection } from '@/ui/components/environment-label';

import { NetworkTypeFilters, type NetworkTypeFilter } from './network-model';
import {
	useNetworksFilter,
	useNetworksFilterStore,
	type NetworksFilterState
} from './networks-filter-store';

export function NetworksFilterScreen() {
	const router = useRouter();
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const filter = useNetworksFilter(key);
	const update = (patch: Partial<NetworksFilterState>) =>
		useNetworksFilterStore.getState().update(key, patch);

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form modifiers={[navigationTitle('Filter'), navigationBarTitleDisplayMode('inline')]}>
						<Section title="Sort">
							<Picker
								label="Sort"
								selection={filter.sortOrder}
								onSelectionChange={(value: ListSortOrder) => update({ sortOrder: value })}
								modifiers={[pickerStyle('inline'), labelsHidden()]}
							>
								{ListSortOrder.allCases.map((order) => (
									<Label
										key={order}
										title={ListSortOrder.title(order)}
										systemImage={ListSortOrder.systemImage(order) as SFSymbol}
										modifiers={[tag(order)]}
									/>
								))}
							</Picker>
						</Section>
						<EnvironmentFilterSection
							environments={filter.environments}
							selection={filter.environmentFilter}
							onSelectionChange={(id) => update({ environmentFilter: id })}
						/>
						<Section title="Type">
							<Picker
								label="Type"
								selection={filter.typeFilter}
								onSelectionChange={(value: NetworkTypeFilter) => update({ typeFilter: value })}
								modifiers={[pickerStyle('inline'), labelsHidden()]}
							>
								{NetworkTypeFilters.map((option) => (
									<Text key={option} modifiers={[tag(option)]}>
										{option}
									</Text>
								))}
							</Picker>
						</Section>
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="confirmationAction">
							<Button label="Done" onPress={() => router.back()} modifiers={toolbarSymbol} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
