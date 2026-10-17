import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { ProjectDetails } from '@/sdk/models/project/Project';
import { colors, systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { MaterialListGroup } from '@/ui/material/list';

import { CenteredMessage } from '@/features/containers/android-material';
import { LongPressMenu } from '@/features/containers/long-press-menu';

import { archivedDateText, projectDisplayName, projectThemedIconUrl } from './project-model';
import { useArchivedProjects } from './use-archived-projects';

function ArchivedProjectRow({
	project,
	onUnarchive
}: {
	project: ProjectDetails;
	onUnarchive: () => void;
}) {
	const isDark = useIsDark();
	return (
		<LongPressMenu
			items={[{ id: 'unarchive', title: 'Unarchive', onPress: onUnarchive }]}
			title={projectDisplayName(project)}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingHorizontal: 16,
				paddingVertical: 12
			}}
		>
			<CachedAsyncImage
				url={projectThemedIconUrl(project, isDark)}
				size={36}
				tiled
				fallback={<RowIcon systemImage="archivebox.fill" tint={systemColors.gray} />}
			/>
			<View style={{ flex: 1, gap: 3 }}>
				<Text numberOfLines={1} style={[m3Type.titleMedium, { color: colors.label }]}>
					{projectDisplayName(project)}
				</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{archivedDateText(project.archivedAt)}
				</Text>
			</View>
		</LongPressMenu>
	);
}

export function ArchivedProjectsScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useArchivedProjects(envID);
	const { snapshot, projects } = model;
	const [refreshing, setRefreshing] = useState(false);

	let content;
	if (snapshot.isLoading && projects.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading archived projects..." />
			</View>
		);
	} else if (snapshot.errorMessage !== undefined && projects.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Error"
				message={snapshot.errorMessage}
			/>
		);
	} else if (projects.length === 0) {
		content = (
			<CenteredMessage
				icon="archivebox"
				title="No Archived Projects"
				message="Archived projects will appear here."
			/>
		);
	} else {
		content = (
			<View>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						paddingHorizontal: 16,
						paddingTop: 20,
						paddingBottom: 6
					}}
				>
					<Text
						accessibilityRole="header"
						style={[m3Type.titleSmall, { flex: 1, color: colors.secondaryLabel }]}
					>
						Archived Projects
					</Text>
					<ResourceCountLabel
						loadedCount={projects.length}
						totalCount={snapshot.totalItems}
						hasMore={snapshot.hasMore}
					/>
				</View>
				<MaterialListGroup>
					{model.displayedProjects.map((project) => (
						<ArchivedProjectRow
							key={project.id}
							project={project}
							onUnarchive={() => void model.unarchive(project)}
						/>
					))}
				</MaterialListGroup>
				<PaginatedListFooter
					hasMore={snapshot.hasMore}
					loadMoreError={snapshot.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</View>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Archived Projects' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
