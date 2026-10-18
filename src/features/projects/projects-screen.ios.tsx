import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { Button, ContextMenu, HStack, List, SwipeActions, VStack } from '@expo/ui/swift-ui';
import {
	buttonStyle,
	frame,
	listStyle,
	refreshable,
	tint,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import {
	EnvironmentActionButton,
	EnvironmentLoadFailuresSection
} from '@/ui/components/environment-label';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { DestructiveLabel, ResourceCountLabel } from '@/ui/components/labels';
import { maintenanceActionInfo } from '@/ui/components/all-environments-maintenance';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowPreviewCard } from '@/ui/components/row-preview-card';
import type { PreviewDetail } from '@/ui/components/row-preview-card.types';
import { StableSectionedList } from '@/ui/components/stable-sectioned-list';
import { EnvironmentToolbarAction } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { capitalized } from '@/features/containers/container-model';
import { useEnvironmentRowColor } from '@/features/containers/hooks';

import {
	projectComposeVersion,
	projectDisplayName,
	projectStatusColor,
	projectThemedIconUrl
} from './project-model';
import { ProjectRow } from './project-row';
import {
	useProjectsList,
	type ProjectItem,
	type ProjectsListModel,
	type ProjectsListProps
} from './use-projects-list';

function ProjectPreview({ item }: { item: ProjectItem }) {
	const isDark = useIsDark();
	const project = item.value;
	const color = projectStatusColor(project.status) ?? systemColors.gray;
	const details: PreviewDetail[] = [
		{
			icon: 'circle.grid.2x2',
			label: 'Services',
			value: `${project.runningCount}/${project.serviceCount} running`
		}
	];
	const version = projectComposeVersion(project);
	if (version !== undefined)
		details.push({ icon: 'doc.text', label: 'Compose Version', value: version });
	details.push({ icon: 'calendar', label: 'Created', value: project.createdAt });
	if (item.environmentName)
		details.push({ icon: 'server.rack', label: 'Environment', value: item.environmentName });
	return (
		<RowPreviewCard
			icon="folder.fill"
			iconColor={color}
			iconUrl={projectThemedIconUrl(project, isDark)}
			title={projectDisplayName(project)}
			badges={[{ text: capitalized(project.status), color }]}
			details={details}
		/>
	);
}

function ProjectLink({ model, item }: { model: ProjectsListModel; item: ProjectItem }) {
	const isPinned = model.pinnedIDs.has(item.id);
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	const pinLabel = isPinned ? 'Unpin' : 'Pin';
	const pinImage: SFSymbol = isPinned ? 'pin.slash.fill' : 'pin.fill';
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					<Button onPress={() => model.openDetail(item)} modifiers={[buttonStyle('plain')]}>
						<HStack modifiers={[contentShape(shapes.rectangle())]}>
							<ProjectRow
								project={item.value}
								isPinned={isPinned}
								environmentName={item.environmentName}
								environmentColor={environmentColor}
							/>
							<DisclosureChevron />
						</HStack>
					</Button>
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button label={pinLabel} systemImage={pinImage} onPress={() => model.togglePin(item)} />
					<Button
						role="destructive"
						onPress={() => model.requestDelete(item)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete" />
					</Button>
				</ContextMenu.Items>
				<ContextMenu.Preview>
					<ProjectPreview item={item} />
				</ContextMenu.Preview>
			</ContextMenu>
			<SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
				<Button
					label={pinLabel}
					systemImage={pinImage}
					onPress={() => model.togglePinAfterSwipe(item)}
					modifiers={[tint(systemColors.yellow)]}
				/>
			</SwipeActions.Actions>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Delete"
					systemImage="trash"
					onPress={() => model.requestDelete(item)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

function ProjectsToolbar({ model }: { model: ProjectsListModel }) {
	const accent = useAccentColor();
	const filterIcon: SFSymbol =
		model.activeFilterCount > 0
			? 'line.3.horizontal.decrease.circle.fill'
			: 'line.3.horizontal.decrease.circle';
	const createEnvironments = model.createEnvironments;
	return (
		<>
			{model.canBrowseTemplates ? (
				<AppToolbar placement="left" tintColor={accent}>
					<Stack.Toolbar.Button
						icon="doc.text.magnifyingglass"
						accessibilityLabel="Browse Templates"
						onPress={model.openTemplates}
					/>
				</AppToolbar>
			) : null}
			<AppToolbar placement="right" tintColor={accent}>
				<Stack.Toolbar.Button
					icon={filterIcon}
					accessibilityLabel="Filter"
					onPress={model.openFilter}
				/>
				<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="More options">
					{model.allEnvironments ? (
						<Stack.Toolbar.Menu inline>
							<Stack.Toolbar.MenuAction
								icon="arrow.triangle.2.circlepath"
								disabled={model.isOperationRunning}
								onPress={() => model.selectMaintenance('update')}
							>
								{maintenanceActionInfo.update.buttonTitle}
							</Stack.Toolbar.MenuAction>
							<Stack.Toolbar.MenuAction
								icon="arrow.clockwise"
								disabled={model.isOperationRunning}
								onPress={() => model.selectMaintenance('checkImages')}
							>
								{maintenanceActionInfo.checkImages.buttonTitle}
							</Stack.Toolbar.MenuAction>
						</Stack.Toolbar.Menu>
					) : null}
					{model.allEnvironments ? (
						EnvironmentToolbarAction({
							title: 'Archived Projects',
							systemImage: 'archivebox',
							environments: model.listEnvironments,
							action: model.openArchived
						})
					) : (
						<Stack.Toolbar.MenuAction
							icon="archivebox"
							onPress={() => model.openArchived(model.environmentID)}
						>
							Archived Projects
						</Stack.Toolbar.MenuAction>
					)}
				</Stack.Toolbar.Menu>
				{!model.allEnvironments ? (
					<Stack.Toolbar.Button
						icon="plus"
						separateBackground
						accessibilityLabel="Create project"
						onPress={() => model.presentCreateProject(model.environmentID)}
					/>
				) : environmentActionIsMenu(createEnvironments) ? (
					<Stack.Toolbar.Menu icon="plus" separateBackground accessibilityLabel="Create project">
						{createEnvironments.map((environment) => (
							<Stack.Toolbar.MenuAction
								key={environment.id}
								onPress={() => model.presentCreateProject(environment.id)}
							>
								{environmentTitle(environment)}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				) : createEnvironments[0] ? (
					<Stack.Toolbar.Button
						icon="plus"
						separateBackground
						accessibilityLabel="Create project"
						onPress={() => model.presentCreateProject(createEnvironments[0]!.id)}
					/>
				) : null}
			</AppToolbar>
		</>
	);
}

export function ProjectsScreen(props: ProjectsListProps) {
	const model = useProjectsList(props);
	const { snapshot, projects } = model;

	let content;
	if (snapshot.isLoading && projects.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && projects.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Projects"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.loadProjects() }]}
			/>
		);
	} else if (projects.length === 0) {
		content = (
			<UnavailableView
				title="No Projects"
				systemImage="folder"
				description={
					props.allEnvironments
						? 'No Compose projects found in any environment.'
						: 'No Compose projects found in this environment.'
				}
			>
				{props.allEnvironments ? (
					<EnvironmentActionButton
						title="Create Project"
						systemImage="plus"
						environments={model.createEnvironments}
						action={model.presentCreateProject}
					/>
				) : (
					<Button
						label="Create Project"
						onPress={() => model.presentCreateProject(props.environmentID)}
					/>
				)}
			</UnavailableView>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
				<EnvironmentLoadFailuresSection
					failures={snapshot.failedEnvironments.map((failure) => ({
						...failure,
						id: failure.environment.id
					}))}
					retry={() => void model.loadProjects()}
				/>
				<StableSectionedList
					sections={model.sections}
					preferredHeaderAccessorySectionID="active"
					headerAccessory={() => (
						<ResourceCountLabel
							loadedCount={projects.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					)}
					estimatedItemSize={46}
					renderRow={(item) => <ProjectLink model={model} item={item} />}
				/>
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Projects',
					headerSearchBarOptions: {
						placeholder: 'Search projects',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<ProjectsToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
