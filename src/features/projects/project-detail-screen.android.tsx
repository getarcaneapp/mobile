import { MenuView } from '@react-native-menu/menu';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
	ActivityIndicator,
	Linking,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	useWindowDimensions,
	View
} from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { singleActionConfig, useDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { m3 } from '@/ui/components/material-colors';
import { nonEmptyResourceValue } from '@/ui/components/resource-detail.types';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { ImageReferenceLine, RowIcon } from '@/ui/components/row-icon';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow } from '@/features/containers/android-material';
import { AndroidResourceActionsToolbar } from '@/features/containers/android-toolbar';
import { containerIsRunning } from '@/features/containers/container-model';

import { ProjectFileBrowserRow } from './project-file-row';
import { EmbeddedProjectLogs } from './project-logs';
import {
	projectComposeVersion,
	projectHeaderDate,
	projectLinks,
	projectTagDisplayColor,
	projectThemedIconUrl,
	runtimeServiceIconURL
} from './project-model';
import {
	useProjectDetail,
	workspaceSections,
	type ProjectDetailModel,
	type RuntimeRow,
	type ServiceAction
} from './use-project-detail';
import { pluralCount } from '@/core/plural';

function RowPressable({ onPress, children }: { onPress?: () => void; children: ReactNode }) {
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			accessibilityRole={onPress ? 'button' : undefined}
			android_ripple={{ color: colors.separator as string }}
			style={{
				minHeight: 56,
				paddingHorizontal: 16,
				paddingVertical: 10,
				justifyContent: 'center'
			}}
		>
			{children}
		</Pressable>
	);
}

function ProjectHeader({ model }: { model: ProjectDetailModel }) {
	const isDark = useIsDark();
	const project = model.currentProject;
	const links = projectLinks(project);
	const tags = project.tags ?? [];
	const date = projectHeaderDate(project.createdAt);
	const version = projectComposeVersion(project);
	return (
		<View style={{ padding: 16, gap: 10 }}>
			<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
				<View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
					<CachedAsyncImage
						url={projectThemedIconUrl(project, isDark)}
						size={28}
						fallback={<Icon name="folder.fill" size={24} color={systemColors.indigo} />}
					/>
					<View style={{ flex: 1 }}>
						<Text style={[m3Type.titleMedium, { color: colors.label }]}>{model.displayName}</Text>
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							{`${pluralCount(project.serviceCount, 'service')} · ${project.runningCount} running`}
						</Text>
					</View>
				</View>
				<View style={{ alignItems: 'flex-end', gap: 4 }}>
					<ResourceStatusBadge status={project.status} usesCardStyle />
					<Text
						accessibilityLabel={`Created ${date}`}
						style={[m3Type.bodySmall, { color: colors.secondaryLabel, textAlign: 'right' }]}
					>
						{date}
					</Text>
				</View>
			</View>
			{tags.length > 0 ? (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: 12 }}
				>
					{tags.map((tag) => (
						<View
							key={tag.name}
							accessible
							accessibilityValue={{
								text: (tag.sources ?? []).includes('compose') ? 'Compose tag' : 'Tag'
							}}
							style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
						>
							<Icon name="tag.fill" size={12} color={projectTagDisplayColor(tag.color)} />
							<Text style={[m3Type.bodySmall, { color: colors.label }]}>{tag.name}</Text>
						</View>
					))}
				</ScrollView>
			) : null}
			{links.length > 0 ? (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: 12 }}
				>
					{links.map((url) => (
						<Pressable
							key={url}
							onPress={() => void Linking.openURL(url)}
							accessibilityRole="link"
							style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
						>
							<Icon name="arrow.up.right.square" size={12} color={m3.primary} />
							<Text style={[m3Type.bodySmall, { color: m3.primary }]}>{url}</Text>
						</Pressable>
					))}
				</ScrollView>
			) : null}
			{version !== undefined ? (
				<View style={{ flexDirection: 'row' }}>
					<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>Compose</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>{version}</Text>
				</View>
			) : null}
		</View>
	);
}

function ServiceRow({ model, row }: { model: ProjectDetailModel; row: RuntimeRow }) {
	const isDark = useIsDark();
	const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
	const { service, container } = row;
	const isRunning =
		(container !== undefined && containerIsRunning(container)) ||
		service.status.toLowerCase() === 'running';
	const image = nonEmptyResourceValue(service.image);
	const permissions = model.servicePermissions;
	const onAction = (action: ServiceAction) => model.performServiceAction(action, row);

	useDeleteConfirmation(
		showRemoveConfirmation,
		setShowRemoveConfirmation,
		singleActionConfig({
			title: `Remove ${service.name}?`,
			message: 'This removes the service container. The Compose service remains in the project.',
			confirmTitle: 'Remove Container',
			dismissOnConfirm: false,
			onConfirm: () => onAction('remove')
		})
	);

	const actions: { id: ServiceAction | 'remove-confirm'; title: string; destructive?: boolean }[] =
		[];
	if (isRunning) {
		if (permissions.stop) actions.push({ id: 'stop', title: 'Stop' });
	} else if (permissions.start) actions.push({ id: 'start', title: 'Start' });
	if (permissions.restart) actions.push({ id: 'restart', title: 'Restart' });
	if (permissions.remove)
		actions.push({ id: 'remove-confirm', title: 'Remove', destructive: true });

	return (
		<View style={{ flexDirection: 'row', alignItems: 'center' }}>
			<Pressable
				onPress={container ? () => model.openContainer(container) : undefined}
				disabled={!container}
				android_ripple={{ color: colors.separator as string }}
				style={{
					flex: 1,
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					paddingLeft: 16,
					paddingRight: 8,
					paddingVertical: 10
				}}
			>
				<CachedAsyncImage
					url={runtimeServiceIconURL(service, isDark)}
					size={36}
					tiled
					fallback={
						<RowIcon
							systemImage="cube.box.fill"
							tint={isRunning ? systemColors.green : systemColors.gray}
						/>
					}
				/>
				<View style={{ flex: 1, gap: 3 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
						<Text style={[m3Type.titleSmall, { color: colors.label }]}>{service.name}</Text>
						<ResourceStatusBadge
							status={nonEmptyResourceValue(service.health) ?? service.status}
							usesCardStyle
						/>
					</View>
					{image ? (
						<ImageReferenceLine reference={image} />
					) : (
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							Image unavailable
						</Text>
					)}
					{service.ports && service.ports.length > 0 ? (
						<Text
							numberOfLines={1}
							style={{ fontFamily: monoFamily, fontSize: 11, color: colors.secondaryLabel }}
						>
							{service.ports.join(', ')}
						</Text>
					) : null}
					{container === undefined ? (
						<Text style={{ fontSize: 11, color: systemColors.orange }}>Container not created</Text>
					) : null}
				</View>
			</Pressable>
			{container && actions.length > 0 ? (
				<MenuView
					actions={actions.map((action) => ({
						id: action.id,
						title: action.title,
						attributes: { destructive: action.destructive }
					}))}
					onPressAction={({ nativeEvent }) => {
						if (nativeEvent.event === 'remove-confirm') setShowRemoveConfirmation(true);
						else onAction(nativeEvent.event as ServiceAction);
					}}
				>
					<View
						accessible
						accessibilityRole="button"
						accessibilityLabel={`Actions for ${service.name}`}
						style={{ padding: 12 }}
					>
						<Icon name="ellipsis.circle" size={22} color={m3.onSurfaceVariant} />
					</View>
				</MenuView>
			) : null}
		</View>
	);
}

function ServicesTab({ model }: { model: ProjectDetailModel }) {
	const [refreshing, setRefreshing] = useState(false);
	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 32 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => {
						setRefreshing(true);
						void model.refresh().finally(() => setRefreshing(false));
					}}
					colors={[systemColors.blue]}
				/>
			}
		>
			<M3Section>
				<ProjectHeader model={model} />
			</M3Section>

			{model.actionStatus !== undefined ? (
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
						{model.isActioning ? <ActivityIndicator size="small" /> : null}
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							{model.actionStatus}
						</Text>
					</View>
				</M3Section>
			) : null}

			{model.errorMessage !== undefined ? (
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
						<Icon name="exclamationmark.triangle" size={16} color={systemColors.red} />
						<Text style={[m3Type.bodySmall, { color: systemColors.red, flex: 1 }]}>
							{model.errorMessage}
						</Text>
					</View>
				</M3Section>
			) : null}

			<M3Section title="Files">
				<RowPressable onPress={() => model.openFiles({ kind: 'compose' })}>
					<ProjectFileBrowserRow
						name={model.composeFileName}
						systemImage="doc.text"
						isDirectory={false}
					/>
				</RowPressable>
				<RowPressable onPress={() => model.openFiles({ kind: 'env' })}>
					<ProjectFileBrowserRow name=".env" systemImage="key.horizontal" isDirectory={false} />
				</RowPressable>
				{model.fileBrowserLoading && model.fileBrowserFiles === undefined ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
						<ActivityIndicator size="small" />
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							Loading files...
						</Text>
					</View>
				) : model.fileBrowserErrorMessage !== undefined ? (
					<View style={{ paddingTop: 12 }}>
						<View
							style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}
						>
							<Icon name="exclamationmark.triangle" size={16} color={systemColors.red} />
							<Text style={[m3Type.bodySmall, { color: systemColors.red, flex: 1 }]}>
								{model.fileBrowserErrorMessage}
							</Text>
						</View>
						<TextButtonRow title="Reload files" onPress={model.reloadFiles} />
					</View>
				) : (
					<>
						{model.pinnedFileBrowserEntries.map((entry) => (
							<RowPressable
								key={entry.id}
								onPress={() => model.openFiles({ kind: 'managedFile', path: entry.relativePath })}
							>
								<ProjectFileBrowserRow
									name={entry.name}
									detail="Compose override"
									systemImage="doc.text"
									isDirectory={false}
								/>
							</RowPressable>
						))}
						<RowPressable onPress={() => model.openFiles({ kind: 'files' })}>
							<ProjectFileBrowserRow
								name="Browse Files"
								systemImage="folder.badge.plus"
								isDirectory
							/>
						</RowPressable>
					</>
				)}
			</M3Section>

			<M3Section title={`Services (${model.runtimeServices.length})`}>
				{model.servicesLoading && model.runtimeServices.length === 0 ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
						<ActivityIndicator size="small" />
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							Loading services…
						</Text>
					</View>
				) : model.runtimeServices.length === 0 ? (
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, padding: 16 }]}>
						No services
					</Text>
				) : (
					model.runtimeRows.map((row) => <ServiceRow key={row.id} model={model} row={row} />)
				)}
			</M3Section>
		</ScrollView>
	);
}

export function ProjectDetailScreen() {
	const {
		id = '',
		envID = '0',
		name = ''
	} = useLocalSearchParams<{ id?: string; envID?: string; name?: string }>();
	const model = useProjectDetail(envID, id, name);
	const { width } = useWindowDimensions();
	const isRegular = width >= 840;

	useDeleteConfirmation(model.showDeleteConfirm, model.setShowDeleteConfirm, {
		title: 'Delete Project',
		message: 'Remove the project from Arcane, or also remove its files from disk.',
		icon: 'trash',
		actions: [
			{ title: 'Delete', action: () => model.deleteProject(false) },
			{ title: 'Delete and Remove Files', action: () => model.deleteProject(true) }
		],
		dismissOnConfirm: false
	});

	const logs = (
		<EmbeddedProjectLogs
			environmentID={model.environmentID}
			projectID={model.projectID}
			title={model.displayName}
			onExpand={model.openLogsFullScreen}
		/>
	);

	return (
		<>
			<Stack.Screen options={{ title: model.displayName }} />
			<AndroidResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.runningActionID}
				isDisabled={model.isActioning}
				resourceName={model.displayName}
			/>
			{isRegular ? (
				<View
					style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.systemGroupedBackground }}
				>
					<View style={{ flex: 1 }}>
						<ServicesTab model={model} />
					</View>
					<View style={{ width: 1, backgroundColor: colors.separator }} />
					<View style={{ flex: 1 }}>{logs}</View>
				</View>
			) : (
				<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
					<ScrollableTabBar
						selection={model.workspaceSection}
						onSelectionChange={model.setWorkspaceSection}
						options={workspaceSections}
						accessibilityLabel="Project workspace sections"
					/>
					<View style={{ flex: 1 }}>
						{model.workspaceSection === 'services' ? <ServicesTab model={model} /> : logs}
					</View>
				</View>
			)}
		</>
	);
}
