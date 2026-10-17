import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	NavigationStack,
	Picker,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	foregroundStyle,
	labelsHidden,
	navigationBarTitleDisplayMode,
	navigationTitle,
	pickerStyle,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { EnvironmentFilterSection } from '@/ui/components/environment-label';

import {
	ResourceUpdateFilters,
	type ResourceUpdateFilter
} from '@/features/containers/container-model';

import {
	ListSortOrders,
	ProjectStatusFilters,
	projectTagDisplayColor,
	type ListSortOrder,
	type ProjectStatusFilter
} from './project-model';
import { useProjectsFilterScreen } from './use-projects-filter-screen';

export function ProjectsFilterScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const router = useRouter();
	const accent = useAccentColor();
	const { key = '' } = useLocalSearchParams<{ key?: string }>();
	const { filter, update, toggleTag } = useProjectsFilterScreen(key);

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
								{ListSortOrders.map((order) => (
									<Label
										key={order.id}
										title={order.title}
										systemImage={order.systemImage as SFSymbol}
										modifiers={[tag(order.id)]}
									/>
								))}
							</Picker>
						</Section>
						<EnvironmentFilterSection
							environments={filter.environments}
							selection={filter.environmentFilter}
							onSelectionChange={(id) => update({ environmentFilter: id })}
						/>
						<Section title="Status">
							<Picker
								label="Status"
								selection={filter.statusFilter}
								onSelectionChange={(value: ProjectStatusFilter) => update({ statusFilter: value })}
								modifiers={[pickerStyle('inline'), labelsHidden()]}
							>
								{ProjectStatusFilters.map((option) => (
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
						{filter.tagOptions.length > 0 ? (
							<Section title="Tags">
								{filter.tagOptions.map((option) => (
									<Button key={option.name} onPress={() => toggleTag(option.name)}>
										<HStack spacing={10}>
											<Image
												systemName="tag.fill"
												modifiers={[foregroundStyle(projectTagDisplayColor(option.color))]}
											/>
											<Text
												modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
											>
												{option.name}
											</Text>
											<Spacer minLength={0} />
											{filter.tagFilter.includes(option.name) ? (
												<Image systemName="checkmark" modifiers={[foregroundStyle(accent)]} />
											) : null}
										</HStack>
									</Button>
								))}
							</Section>
						) : null}
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
