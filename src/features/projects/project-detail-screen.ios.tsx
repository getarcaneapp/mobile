import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Label,
	LabeledContent,
	Link,
	List,
	Menu,
	ProgressView,
	ScrollView,
	Section,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	accessibilityValue,
	buttonStyle,
	contentShape,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	multilineTextAlignment,
	padding,
	refreshable,
	scaleEffect,
	scrollIndicators,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { singleActionConfig, useDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { DestructiveLabel } from '@/ui/components/labels';
import { nonEmptyResourceValue } from '@/ui/components/resource-detail.types';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { ImageReferenceLine, RowIcon } from '@/ui/components/row-icon';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

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

function useIsRegularWidth() {
	const { width } = useWindowDimensions();
	return Platform.OS === 'ios' && Platform.isPad && width >= 600;
}

function ProjectMetadata({ model }: { model: ProjectDetailModel }) {
	const links = projectLinks(model.currentProject);
	const tags = model.currentProject.tags ?? [];
	if (links.length === 0 && tags.length === 0) return null;
	return (
		<VStack
			alignment="leading"
			spacing={8}
			modifiers={[font({ textStyle: 'caption' }), padding({ vertical: 4 })]}
		>
			{tags.length > 0 ? (
				<ScrollView axes="horizontal" modifiers={[scrollIndicators('hidden')]}>
					<HStack spacing={12} modifiers={[fixedSize({ horizontal: true, vertical: false })]}>
						{tags.map((tag) => (
							<Label
								key={tag.name}
								title={tag.name}
								icon={
									<Image
										systemName="tag.fill"
										modifiers={[foregroundStyle(projectTagDisplayColor(tag.color))]}
									/>
								}
								modifiers={[
									accessibilityValue(
										(tag.sources ?? []).includes('compose') ? 'Compose tag' : 'Tag'
									)
								]}
							/>
						))}
					</HStack>
				</ScrollView>
			) : null}
			{links.length > 0 ? (
				<ScrollView axes="horizontal" modifiers={[scrollIndicators('hidden')]}>
					<HStack spacing={12} modifiers={[fixedSize({ horizontal: true, vertical: false })]}>
						{links.map((url) => (
							<Link key={url} destination={url} modifiers={[buttonStyle('borderless')]}>
								<HStack spacing={4}>
									<Image systemName="arrow.up.right.square" />
									<Text>{url}</Text>
								</HStack>
							</Link>
						))}
					</HStack>
				</ScrollView>
			) : null}
		</VStack>
	);
}

function ProjectHeader({ model }: { model: ProjectDetailModel }) {
	const isDark = useIsDark();
	const project = model.currentProject;
	const date = projectHeaderDate(project.createdAt);
	const version = projectComposeVersion(project);
	return (
		<>
			<VStack alignment="leading" spacing={10}>
				<HStack alignment="top" spacing={12}>
					<Label
						icon={
							<CachedAsyncImageSwiftUI
								url={projectThemedIconUrl(project, isDark)}
								size={28}
								fallback={
									<Image
										systemName="folder.fill"
										modifiers={[foregroundStyle(systemColors.indigo)]}
									/>
								}
							/>
						}
						modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
					>
						<VStack alignment="leading">
							<Text modifiers={[font({ textStyle: 'headline' })]}>{model.displayName}</Text>
							<Text
								modifiers={[
									font({ textStyle: 'subheadline' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{`${pluralCount(project.serviceCount, 'service')} · ${project.runningCount} running`}
							</Text>
						</VStack>
					</Label>
					<VStack alignment="trailing" spacing={4}>
						<ResourceStatusBadge status={project.status} usesCardStyle />
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
								multilineTextAlignment('trailing'),
								accessibilityLabel(`Created ${date}`)
							]}
						>
							{date}
						</Text>
					</VStack>
				</HStack>
				<ProjectMetadata model={model} />
			</VStack>
			{version !== undefined ? (
				<LabeledContent label="Compose">
					<Text>{version}</Text>
				</LabeledContent>
			) : null}
		</>
	);
}

function ServiceRowContent({ row, isRunning }: { row: RuntimeRow; isRunning: boolean }) {
	const isDark = useIsDark();
	const { service, container } = row;
	const image = nonEmptyResourceValue(service.image);
	return (
		<HStack spacing={10} modifiers={[contentShape(shapes.rectangle())]}>
			<CachedAsyncImageSwiftUI
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
			<VStack
				alignment="leading"
				spacing={3}
				modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
			>
				<HStack spacing={6}>
					<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
						{service.name}
					</Text>
					<ResourceStatusBadge
						status={nonEmptyResourceValue(service.health) ?? service.status}
						usesCardStyle
					/>
				</HStack>
				{image ? (
					<ImageReferenceLine reference={image} />
				) : (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						Image unavailable
					</Text>
				)}
				{service.ports && service.ports.length > 0 ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2', design: 'monospaced' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(1)
						]}
					>
						{service.ports.join(', ')}
					</Text>
				) : null}
				{container === undefined ? (
					<Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(systemColors.orange)]}>
						Container not created
					</Text>
				) : null}
			</VStack>
		</HStack>
	);
}

function ProjectRuntimeServiceRow({ model, row }: { model: ProjectDetailModel; row: RuntimeRow }) {
	const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
	const { service, container } = row;
	const isRunning =
		(container !== undefined && containerIsRunning(container)) ||
		service.status.toLowerCase() === 'running';
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

	return (
		<HStack spacing={10}>
			{container ? (
				<Button onPress={() => model.openContainer(container)} modifiers={[buttonStyle('plain')]}>
					<HStack modifiers={[contentShape(shapes.rectangle())]}>
						<ServiceRowContent row={row} isRunning={isRunning} />
						<DisclosureChevron />
					</HStack>
				</Button>
			) : (
				<ServiceRowContent row={row} isRunning={isRunning} />
			)}

			{container ? (
				<Menu
					label={<Image systemName="ellipsis.circle" />}
					modifiers={[accessibilityLabel(`Actions for ${service.name}`)]}
				>
					{isRunning ? (
						permissions.stop ? (
							<Button label="Stop" systemImage="stop.fill" onPress={() => onAction('stop')} />
						) : null
					) : permissions.start ? (
						<Button label="Start" systemImage="play.fill" onPress={() => onAction('start')} />
					) : null}
					{permissions.restart ? (
						<Button
							label="Restart"
							systemImage="arrow.clockwise"
							onPress={() => onAction('restart')}
						/>
					) : null}
					{permissions.remove ? (
						<Button
							role="destructive"
							onPress={() => setShowRemoveConfirmation(true)}
							modifiers={[tint(systemColors.red)]}
						>
							<DestructiveLabel text="Remove" />
						</Button>
					) : null}
				</Menu>
			) : null}
		</HStack>
	);
}

function FileButton({ onPress, children }: { onPress: () => void; children: React.ReactElement }) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			{children}
		</Button>
	);
}

function ProjectFilesSection({ model }: { model: ProjectDetailModel }) {
	return (
		<Section title="Files">
			<FileButton onPress={() => model.openFiles({ kind: 'compose' })}>
				<ProjectFileBrowserRow
					name={model.composeFileName}
					systemImage="doc.text"
					isDirectory={false}
				/>
			</FileButton>
			<FileButton onPress={() => model.openFiles({ kind: 'env' })}>
				<ProjectFileBrowserRow name=".env" systemImage="key.horizontal" isDirectory={false} />
			</FileButton>
			{model.fileBrowserLoading && model.fileBrowserFiles === undefined ? (
				<HStack spacing={10}>
					<ProgressView modifiers={[scaleEffect(0.8)]} />
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						Loading files...
					</Text>
				</HStack>
			) : model.fileBrowserErrorMessage !== undefined ? (
				<VStack alignment="leading" spacing={8}>
					<Label
						title={model.fileBrowserErrorMessage}
						systemImage="exclamationmark.triangle"
						modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.red)]}
					/>
					<Button
						onPress={model.reloadFiles}
						modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}
					>
						<Label title="Reload files" systemImage="arrow.clockwise" />
					</Button>
				</VStack>
			) : (
				<>
					{model.pinnedFileBrowserEntries.map((entry) => (
						<FileButton
							key={entry.id}
							onPress={() => model.openFiles({ kind: 'managedFile', path: entry.relativePath })}
						>
							<ProjectFileBrowserRow
								name={entry.name}
								detail="Compose override"
								systemImage="doc.text"
								isDirectory={false}
							/>
						</FileButton>
					))}
					<FileButton onPress={() => model.openFiles({ kind: 'files' })}>
						<ProjectFileBrowserRow
							name="Browse Files"
							systemImage="folder.badge.plus"
							isDirectory
						/>
					</FileButton>
				</>
			)}
		</Section>
	);
}

function ServicesTab({ model }: { model: ProjectDetailModel }) {
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			<Section>
				<ProjectHeader model={model} />
			</Section>

			{model.actionStatus !== undefined ? (
				<Section>
					<HStack spacing={10}>
						{model.isActioning ? <ProgressView modifiers={[scaleEffect(0.8)]} /> : null}
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{model.actionStatus}
						</Text>
					</HStack>
				</Section>
			) : null}

			{model.errorMessage !== undefined ? (
				<Section>
					<Label
						title={model.errorMessage}
						systemImage="exclamationmark.triangle"
						modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'caption' })]}
					/>
				</Section>
			) : null}

			<ProjectFilesSection model={model} />

			<Section header={<Text>{`Services (${model.runtimeServices.length})`}</Text>}>
				{model.servicesLoading && model.runtimeServices.length === 0 ? (
					<HStack spacing={10}>
						<ProgressView modifiers={[scaleEffect(0.8)]} />
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							Loading services…
						</Text>
					</HStack>
				) : model.runtimeServices.length === 0 ? (
					<Text
						modifiers={[
							font({ textStyle: 'callout' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						No services
					</Text>
				) : (
					model.runtimeRows.map((row) => (
						<ProjectRuntimeServiceRow key={row.id} model={model} row={row} />
					))
				)}
			</Section>
		</List>
	);
}

export function ProjectDetailScreen() {
	const {
		id = '',
		envID = '0',
		name = ''
	} = useLocalSearchParams<{ id?: string; envID?: string; name?: string }>();
	const model = useProjectDetail(envID, id, name);
	const isRegular = useIsRegularWidth();

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

	const services = (
		<Host style={{ flex: 1 }}>
			<ServicesTab model={model} />
		</Host>
	);
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
			<Stack.Screen
				options={{
					title: model.displayName,
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false
				}}
			/>
			<ResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.runningActionID}
				isDisabled={model.isActioning}
				resourceName={model.displayName}
			/>
			{isRegular ? (
				<View style={{ flex: 1, flexDirection: 'row' }}>
					<View style={{ flex: 1 }}>{services}</View>
					<View style={{ width: 0.5, backgroundColor: colors.separator }} />
					<View style={{ flex: 1 }}>{logs}</View>
				</View>
			) : (
				<View style={{ flex: 1 }}>
					<ScrollableTabBar
						selection={model.workspaceSection}
						onSelectionChange={model.setWorkspaceSection}
						options={workspaceSections}
						accessibilityLabel="Project workspace sections"
					/>
					<View style={{ flex: 1 }}>{model.workspaceSection === 'services' ? services : logs}</View>
				</View>
			)}
		</>
	);
}
