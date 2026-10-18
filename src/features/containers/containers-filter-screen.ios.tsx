import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	Picker,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	labelsHidden,
	navigationBarTitleDisplayMode,
	navigationTitle,
	pickerStyle,
	tag,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { EnvironmentFilterSection } from '@/ui/components/environment-label';

import {
	ContainerListSorts,
	ContainerStateFilters,
	ResourceUpdateFilters,
	type ContainerListSort,
	type ContainerStateFilter,
	type ResourceUpdateFilter
} from './container-model';
import { useContainersFilter, useContainersFilterStore } from './containers-filter-store';
import { BoundTextField } from './swiftui-text-field';

export function ContainersFilterScreen() {
	const router = useRouter();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const filter = useContainersFilter(key);
	const update = (
		patch: Parameters<ReturnType<typeof useContainersFilterStore.getState>['update']>[1]
	) => useContainersFilterStore.getState().update(key, patch);

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form modifiers={[navigationTitle('Filter'), navigationBarTitleDisplayMode('inline')]}>
						<Section header={<Text>Sort</Text>}>
							<Picker
								label="Sort"
								selection={filter.sort}
								onSelectionChange={(value: ContainerListSort) => update({ sort: value })}
								modifiers={[pickerStyle('inline'), labelsHidden()]}
							>
								{ContainerListSorts.map((option) => (
									<Label
										key={option.id}
										title={option.title}
										systemImage={option.systemImage as SFSymbol}
										modifiers={[tag(option.id)]}
									/>
								))}
							</Picker>
						</Section>
						<EnvironmentFilterSection
							environments={filter.environments}
							selection={filter.environmentFilter}
							onSelectionChange={(id) => update({ environmentFilter: id })}
						/>
						<Section title="State">
							<Picker
								label="State"
								selection={filter.stateFilter}
								onSelectionChange={(value: ContainerStateFilter) => update({ stateFilter: value })}
								modifiers={[pickerStyle('inline'), labelsHidden()]}
							>
								{ContainerStateFilters.map((option) => (
									<Text key={option} modifiers={[tag(option)]}>
										{option}
									</Text>
								))}
							</Picker>
						</Section>
						<Section title="Updates">
							<Picker
								label="Updates"
								selection={filter.updateFilter}
								onSelectionChange={(value: ResourceUpdateFilter) => update({ updateFilter: value })}
								modifiers={[pickerStyle('inline'), labelsHidden()]}
							>
								{ResourceUpdateFilters.map((option) => (
									<Text key={option.id} modifiers={[tag(option.id)]}>
										{option.title}
									</Text>
								))}
							</Picker>
						</Section>
						<Section title="Visibility">
							<Toggle
								label="Show hidden"
								isOn={filter.showHidden}
								onIsOnChange={(isOn) => update({ showHidden: isOn })}
							/>
							<BoundTextField
								placeholder="Label (key or key=value)"
								value={filter.labelFilter}
								onChangeText={(text) => update({ labelFilter: text })}
								modifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}
							/>
						</Section>
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="confirmationAction">
							<Button label="Done" onPress={() => router.back()} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
