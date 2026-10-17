import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	HStack,
	List,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	padding,
	refreshable,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import type { ProjectDetails } from '@/sdk/models/project/Project';
import { systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';

import { archivedDateText, projectDisplayName, projectThemedIconUrl } from './project-model';
import { useArchivedProjects } from './use-archived-projects';

function ArchivedProjectRow({ project }: { project: ProjectDetails }) {
	const isDark = useIsDark();
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<CachedAsyncImageSwiftUI
				url={projectThemedIconUrl(project, isDark)}
				size={36}
				tiled
				fallback={<RowIcon systemImage="archivebox.fill" tint={systemColors.gray} />}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>
					{projectDisplayName(project)}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{archivedDateText(project.archivedAt)}
				</Text>
			</VStack>
			<Spacer />
		</HStack>
	);
}

export function ArchivedProjectsScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useArchivedProjects(envID);
	const { snapshot, projects } = model;

	let content;
	if (snapshot.isLoading && projects.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading archived projects..." />
			</VStack>
		);
	} else if (snapshot.errorMessage !== undefined && projects.length === 0) {
		content = (
			<ContentUnavailableView
				title="Error"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
			/>
		);
	} else if (projects.length === 0) {
		content = (
			<ContentUnavailableView
				title="No Archived Projects"
				systemImage="archivebox"
				description="Archived projects will appear here."
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				<Section
					header={
						<ResourceCountSectionHeader
							title="Archived Projects"
							loadedCount={projects.length}
							totalCount={snapshot.totalItems}
							hasMore={snapshot.hasMore}
						/>
					}
				>
					{model.displayedProjects.map((project) => (
						<SwipeActions key={project.id}>
							<ContextMenu>
								<ContextMenu.Trigger>
									<ArchivedProjectRow project={project} />
								</ContextMenu.Trigger>
								<ContextMenu.Items>
									<Button
										label="Unarchive"
										systemImage="tray.and.arrow.up"
										onPress={() => void model.unarchive(project)}
									/>
								</ContextMenu.Items>
							</ContextMenu>
							<SwipeActions.Actions edge="trailing">
								<Button
									label="Unarchive"
									systemImage="tray.and.arrow.up"
									onPress={() => void model.unarchive(project)}
									modifiers={[tint(systemColors.indigo)]}
								/>
							</SwipeActions.Actions>
						</SwipeActions>
					))}
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</Section>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Archived Projects', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
