import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { maintenanceActionInfo } from '@/ui/components/all-environments-maintenance';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	EnvironmentActionButton,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { VirtualizedSectionedList } from '@/ui/components/virtualized-sectioned-list';
import { MaterialListGroup } from '@/ui/material/list';

import { CenteredMessage } from '@/features/containers/android-material';
import {
	AndroidToolbar,
	type AndroidMenuItem,
	type AndroidToolbarItem
} from '@/features/containers/android-toolbar';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';

import { projectDisplayName } from './project-model';
import { ProjectRow } from './project-row';
import {
	useProjectsList,
	type ProjectItem,
	type ProjectsListModel,
	type ProjectsListProps
} from './use-projects-list';
import { sectionItemCount, spansSections } from '@/ui/components/stable-sectioned-list.types';

const rowStyle = { paddingHorizontal: 16, paddingVertical: 10 };

function ProjectListRow({ model, item }: { model: ProjectsListModel; item: ProjectItem }) {
	const isPinned = model.pinnedIDs.has(item.id);
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	const items: RowMenuItem[] = [
		{ id: 'pin', title: isPinned ? 'Unpin' : 'Pin', onPress: () => model.togglePin(item) },
		{ id: 'delete', title: 'Delete', destructive: true, onPress: () => model.requestDelete(item) }
	];
	return (
		<LongPressMenu
			items={items}
			title={projectDisplayName(item.value)}
			onPress={() => model.openDetail(item)}
			style={rowStyle}
		>
			<ProjectRow
				project={item.value}
				isPinned={isPinned}
				environmentName={item.environmentName}
				environmentColor={environmentColor}
			/>
		</LongPressMenu>
	);
}

function ProjectsToolbar({ model }: { model: ProjectsListModel }) {
	const options: AndroidMenuItem[] = [];
	if (model.allEnvironments) {
		options.push(
			{
				id: 'update-all',
				title: maintenanceActionInfo.update.buttonTitle,
				disabled: model.isOperationRunning,
				onPress: () => model.selectMaintenance('update')
			},
			{
				id: 'check-all',
				title: maintenanceActionInfo.checkImages.buttonTitle,
				disabled: model.isOperationRunning,
				onPress: () => model.selectMaintenance('checkImages')
			}
		);
		if (environmentActionIsMenu(model.listEnvironments)) {
			for (const environment of model.listEnvironments) {
				options.push({
					id: `archived-${environment.id}`,
					title: `Archived Projects · ${environmentTitle(environment)}`,
					onPress: () => model.openArchived(environment.id)
				});
			}
		} else if (model.listEnvironments[0]) {
			const first = model.listEnvironments[0];
			options.push({
				id: 'archived',
				title: 'Archived Projects',
				onPress: () => model.openArchived(first.id)
			});
		}
	} else {
		options.push({
			id: 'archived',
			title: 'Archived Projects',
			onPress: () => model.openArchived(model.environmentID)
		});
	}

	const items: AndroidToolbarItem[] = [];
	if (model.canBrowseTemplates) {
		items.push({
			kind: 'button',
			id: 'templates',
			icon: 'doc.text.magnifyingglass',
			label: 'Browse Templates',
			onPress: model.openTemplates
		});
	}
	items.push({
		kind: 'button',
		id: 'filter',
		icon:
			model.activeFilterCount > 0
				? 'line.3.horizontal.decrease.circle.fill'
				: 'line.3.horizontal.decrease.circle',
		label: 'Filter',
		onPress: model.openFilter
	});
	const create = model.createEnvironments;
	if (!model.allEnvironments) {
		items.push({
			kind: 'button',
			id: 'create',
			icon: 'plus',
			label: 'Create project',
			onPress: () => model.presentCreateProject(model.environmentID)
		});
	} else if (environmentActionIsMenu(create)) {
		items.push({
			kind: 'menu',
			id: 'create',
			icon: 'plus',
			label: 'Create project',
			items: create.map((environment) => ({
				id: environment.id,
				title: environmentTitle(environment),
				onPress: () => model.presentCreateProject(environment.id)
			}))
		});
	} else if (create[0]) {
		const first = create[0];
		items.push({
			kind: 'button',
			id: 'create',
			icon: 'plus',
			label: 'Create project',
			onPress: () => model.presentCreateProject(first.id)
		});
	}
	items.push({
		kind: 'menu',
		id: 'options',
		icon: 'ellipsis.circle',
		label: 'More options',
		items: options
	});
	return <AndroidToolbar items={items} />;
}

export function ProjectsScreen(props: ProjectsListProps) {
	const model = useProjectsList(props);
	const { snapshot, projects } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(model.refresh, () => setRefreshing(false));
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={() => void onRefresh()}
			colors={[systemColors.blue]}
		/>
	);

	const visibleCount = sectionItemCount(model.sections);
	const isFiltered = visibleCount < projects.length;
	let content;
	if (snapshot.isLoading && projects.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && projects.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Projects"
				message={snapshot.errorMessage}
				action={{ title: 'Retry', onPress: () => void model.loadProjects() }}
			/>
		);
	} else if (projects.length === 0 && model.searchText.trim() === '') {
		content = props.allEnvironments ? (
			<View style={{ flex: 1, justifyContent: 'center' }}>
				<CenteredMessage
					icon="folder"
					title="No Projects"
					message="No Compose projects found in any environment."
				/>
				<MaterialListGroup>
					<EnvironmentActionButton
						title="Create Project"
						systemImage="plus"
						environments={model.createEnvironments}
						action={model.presentCreateProject}
					/>
				</MaterialListGroup>
			</View>
		) : (
			<CenteredMessage
				icon="folder"
				title="No Projects"
				message="No Compose projects found in this environment."
				action={{
					title: 'Create Project',
					onPress: () => model.presentCreateProject(props.environmentID)
				}}
			/>
		);
	} else if (visibleCount === 0 && !snapshot.hasMore) {
		content = (
			<CenteredMessage
				icon="magnifyingglass"
				title="No Results"
				message="Nothing matches the current search or filter."
			/>
		);
	}

	const list =
		content === undefined ? (
			<VirtualizedSectionedList
				onEndReached={
					snapshot.hasMore && snapshot.loadMoreError === undefined
						? () => void model.loadMore()
						: undefined
				}
				sections={model.sections}
				preferredHeaderAccessorySectionID="active"
				headerAccessory={() => (
					<ResourceCountLabel
						spansSections={spansSections(model.sections)}
						loadedCount={isFiltered ? visibleCount : projects.length}
						totalCount={isFiltered ? undefined : snapshot.totalItems}
						hasMore={!isFiltered && snapshot.hasMore}
					/>
				)}
				renderRow={(item) => <ProjectListRow model={model} item={item} />}
				header={
					<EnvironmentLoadFailuresSection
						failures={snapshot.failedEnvironments.map((failure) => ({
							...failure,
							id: failure.environment.id
						}))}
						retry={() => void model.loadProjects()}
					/>
				}
				footer={
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				}
				refreshControl={refreshControl}
			/>
		) : (
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={refreshControl}
			>
				{content}
			</ScrollView>
		);

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Projects',
					headerSearchBarOptions: {
						placeholder: 'Search projects',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<ProjectsToolbar model={model} />
			{list}
		</>
	);
}
