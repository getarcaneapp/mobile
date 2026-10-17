/** Port of `GitOpsSyncDetailView` (GitOpsSyncDetailView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	DisclosureGroup,
	HStack,
	Label,
	LabeledContent,
	Link,
	List,
	Section,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	padding,
	refreshable,
	shapes,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { formatDate } from '@/core/date-formatting';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { relativeNamed } from '@/features/dashboard/use-all-environments-dashboard';
import { systemColors } from '@/theme/colors';
import { capitalized } from '@/ui/components/resource-status';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { useGitOpsSyncDetail, type GitOpsSyncDetailModel } from './use-gitops-sync-detail';

function DetailSection({
	title,
	systemImage,
	footer,
	children
}: {
	title: string;
	systemImage: string;
	footer?: string;
	children: ReactNode;
}) {
	return (
		<Section
			header={<Label title={title} systemImage={systemImage as SFSymbol} />}
			footer={footer ? <Text>{footer}</Text> : undefined}
		>
			{children}
		</Section>
	);
}

function DateRow({ label, date }: { label: string; date?: Date }) {
	return (
		<LabeledContent label={label}>
			{date ? (
				<VStack alignment="trailing" spacing={2}>
					<Text>{relativeNamed(date.getTime())}</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
						]}
					>
						{formatDate(date, 'abbreviated', 'shortened')}
					</Text>
				</VStack>
			) : (
				<Text>Never</Text>
			)}
		</LabeledContent>
	);
}

function PathRow({ path }: { path: string }) {
	return (
		<Label
			icon={
				<Image
					systemName={path.endsWith('/') ? 'folder' : 'doc.text'}
					modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
				/>
			}
		>
			<Text
				modifiers={[
					font({ textStyle: 'callout', design: 'monospaced' }),
					lineLimit(2),
					truncationMode('middle'),
					textSelection(true)
				]}
			>
				{path}
			</Text>
		</Label>
	);
}

function CommitRow({ model }: { model: GitOpsSyncDetailModel }) {
	const commit = model.sync.lastSyncCommit;
	const short = model.shortCommit;
	if (commit === undefined || short === undefined) return null;
	const commitURL = model.commitURL;
	const value = (
		<Text modifiers={[font({ textStyle: 'body', design: 'monospaced' })]}>{short}</Text>
	);
	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<LabeledContent label="Commit">
					{commitURL ? <Link destination={commitURL}>{value}</Link> : value}
				</LabeledContent>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<Button
					label="Copy Commit Hash"
					systemImage="doc.on.doc"
					onPress={() => model.copy(commit)}
				/>
				{commitURL ? (
					<Button
						label="Open Commit"
						systemImage="arrow.up.right.square"
						onPress={() => model.openURL(commitURL)}
					/>
				) : null}
			</ContextMenu.Items>
		</ContextMenu>
	);
}

function Header({ model }: { model: GitOpsSyncDetailModel }) {
	const { sync, isBackup, status } = model;
	return (
		<HStack spacing={16}>
			<Image
				systemName={isBackup ? 'arrow.up.doc.fill' : 'arrow.triangle.merge'}
				modifiers={[
					font({ textStyle: 'title' }),
					foregroundStyle(systemColors.indigo),
					frame({ width: 56, height: 56 }),
					accessibilityHidden(true)
				]}
			/>
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{sync.name}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{isBackup ? 'Backs up to Git' : 'Deploys from Git'}
				</Text>
				<VStack modifiers={[padding({ top: 2 })]}>
					<ResourceStatusBadge status={status.status} usesCardStyle label={status.label} />
				</VStack>
			</VStack>
		</HStack>
	);
}

function ErrorSection({ model, error }: { model: GitOpsSyncDetailModel; error: string }) {
	return (
		<Section
			header={
				<Label
					title={model.isBackup ? 'Backup Error' : 'Sync Error'}
					systemImage="exclamationmark.triangle"
				/>
			}
		>
			<Text
				modifiers={[
					font({ textStyle: 'callout' }),
					foregroundStyle(systemColors.red),
					textSelection(true)
				]}
			>
				{error}
			</Text>
			{model.isBackup && model.backupFailureDescription !== undefined ? (
				<LabeledContent label="Reason">
					<Text>{model.backupFailureDescription}</Text>
				</LabeledContent>
			) : null}
		</Section>
	);
}

function ProjectRow({ model }: { model: GitOpsSyncDetailModel }) {
	const name = model.sync.projectName ?? 'Not created yet';
	if (model.projectLinks) {
		return (
			<Button onPress={model.openProject} modifiers={[buttonStyle('plain')]}>
				<HStack modifiers={[contentShape(shapes.rectangle())]}>
					<LabeledContent label="Project">
						<Text>{name}</Text>
					</LabeledContent>
					<DisclosureChevron />
				</HStack>
			</Button>
		);
	}
	return (
		<LabeledContent label={model.targetLabel}>
			<Text>{name}</Text>
		</LabeledContent>
	);
}

function SourceSection({ model }: { model: GitOpsSyncDetailModel }) {
	const { sync } = model;
	return (
		<DetailSection title="Repository" systemImage="externaldrive.connected.to.line.below">
			<LabeledContent label="Repository">
				<Text>{sync.repositoryName ?? sync.repositoryURL ?? 'Unknown'}</Text>
			</LabeledContent>
			{sync.repositoryName !== undefined && sync.repositoryURL !== undefined ? (
				<LabeledContent label="URL">
					<MonospacedValue value={sync.repositoryURL} lineLimit={1} />
				</LabeledContent>
			) : null}
			{sync.branch !== undefined ? (
				<LabeledContent label="Branch">
					<MonospacedValue value={sync.branch} lineLimit={1} />
				</LabeledContent>
			) : null}
			{model.isBackup ? (
				<LabeledContent label="Backup Directory">
					<MonospacedValue value={sync.backupDirectory ?? '/'} lineLimit={2} />
				</LabeledContent>
			) : sync.composePath !== undefined ? (
				<LabeledContent label="Compose File">
					<MonospacedValue value={sync.composePath} lineLimit={2} />
				</LabeledContent>
			) : null}
			<ProjectRow model={model} />
			{model.repositoryWebURL !== undefined ? (
				<Link destination={model.repositoryWebURL}>
					<Label title="Open Repository" systemImage="arrow.up.right.square" />
				</Link>
			) : null}
		</DetailSection>
	);
}

function LastSyncSection({ model }: { model: GitOpsSyncDetailModel }) {
	return (
		<DetailSection title="Last Sync" systemImage="clock.arrow.circlepath">
			<LabeledContent label="Status">
				<ResourceStatusBadge status={model.status.status} label={model.status.label} />
			</LabeledContent>
			<DateRow label="Synced" date={model.sync.lastSyncAt} />
			<CommitRow model={model} />
		</DetailSection>
	);
}

function ValueRow({ label, value }: { label: string; value: string }) {
	return (
		<LabeledContent label={label}>
			<Text>{value}</Text>
		</LabeledContent>
	);
}

function AutomationSection({ model }: { model: GitOpsSyncDetailModel }) {
	const { sync } = model;
	return (
		<DetailSection title="Automation" systemImage="gearshape.2">
			<ValueRow label="Auto Sync" value={sync.autoSync ? model.syncIntervalDescription : 'Off'} />
			<ValueRow
				label="Sync Scope"
				value={sync.syncDirectory ? 'Entire directory' : 'Compose file only'}
			/>
			<ValueRow label="Pull Images After Sync" value={sync.pullImageAfterSync ? 'On' : 'Off'} />
			<ValueRow label="Redeploy After Sync" value={sync.redeployAfterSync ? 'On' : 'Off'} />
		</DetailSection>
	);
}

function PreDeploySection({ model }: { model: GitOpsSyncDetailModel }) {
	const { sync } = model;
	if (sync.preDeployScriptPath === undefined) return null;
	const status = sync.preDeployLastRunStatus;
	return (
		<DetailSection title="Pre-Deploy Hook" systemImage="terminal">
			<LabeledContent label="Script">
				<MonospacedValue value={sync.preDeployScriptPath} lineLimit={2} />
			</LabeledContent>
			{sync.preDeployRunnerImage !== undefined ? (
				<LabeledContent label="Runner Image">
					<MonospacedValue value={sync.preDeployRunnerImage} lineLimit={1} />
				</LabeledContent>
			) : null}
			{status !== undefined ? (
				<LabeledContent label="Last Run">
					<ResourceStatusBadge
						status={status === 'timeout' ? 'failed' : status}
						label={capitalized(status)}
					/>
				</LabeledContent>
			) : null}
			{sync.preDeployLastRunAt !== undefined ? (
				<DateRow label="Ran" date={sync.preDeployLastRunAt} />
			) : null}
		</DetailSection>
	);
}

function BackupSection({ model }: { model: GitOpsSyncDetailModel }) {
	const { sync } = model;
	return (
		<DetailSection title="Backup" systemImage="arrow.up.doc">
			<LabeledContent label="State">
				<ResourceStatusBadge status={model.status.status} label={model.status.label} />
			</LabeledContent>
			<DateRow label="Last Backup" date={sync.lastBackupAt} />
			<DateRow label="Last Check" date={sync.lastSyncAt} />
			<CommitRow model={model} />
			<ValueRow label="Trigger" value={sync.backupOnSave ? 'On Save' : 'Manual'} />
			{sync.backupPending ? <ValueRow label="Pending Changes" value="Waiting to push" /> : null}
		</DetailSection>
	);
}

function BackupPathsSection({ model }: { model: GitOpsSyncDetailModel }) {
	const paths = model.sync.backupPaths;
	return (
		<DetailSection
			title="Backup Paths"
			systemImage="folder"
			footer="Compose files are always included."
		>
			{paths.length === 0 ? (
				<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
					Compose files only
				</Text>
			) : (
				paths.map((path) => <PathRow key={path} path={path} />)
			)}
		</DetailSection>
	);
}

function SyncedFilesSection({ model }: { model: GitOpsSyncDetailModel }) {
	const files = model.sync.syncedFiles;
	if (files.length === 0) return null;
	return (
		<Section>
			<DisclosureGroup>
				<DisclosureGroup.Label>
					<LabeledContent label={model.isBackup ? 'Files in Last Backup' : 'Synced Files'}>
						<Text>{String(files.length)}</Text>
					</LabeledContent>
				</DisclosureGroup.Label>
				{files.map((path) => (
					<PathRow key={path} path={path} />
				))}
			</DisclosureGroup>
		</Section>
	);
}

function DetailsSection({ model }: { model: GitOpsSyncDetailModel }) {
	const { sync } = model;
	return (
		<DetailSection title="Details" systemImage="info.circle">
			{model.environmentName !== undefined ? (
				<ValueRow label="Environment" value={model.environmentName} />
			) : null}
			{sync.maxSyncFiles > 0 ? (
				<ValueRow label="File Limit" value={String(sync.maxSyncFiles)} />
			) : null}
			{sync.maxSyncTotalSize > 0 ? (
				<ValueRow label="Total Size Limit" value={formatFileBytes(sync.maxSyncTotalSize)} />
			) : null}
			{sync.maxSyncBinarySize > 0 ? (
				<ValueRow label="Binary File Limit" value={formatFileBytes(sync.maxSyncBinarySize)} />
			) : null}
			{sync.createdAt ? (
				<ValueRow label="Created" value={formatDate(sync.createdAt, 'abbreviated', 'shortened')} />
			) : null}
			{sync.updatedAt ? (
				<ValueRow label="Updated" value={formatDate(sync.updatedAt, 'abbreviated', 'shortened')} />
			) : null}
			<ContextMenu>
				<ContextMenu.Trigger>
					<LabeledContent label="Sync ID">
						<Text
							modifiers={[
								font({ textStyle: 'caption', design: 'monospaced' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
								textSelection(true),
								lineLimit(1),
								truncationMode('middle')
							]}
						>
							{sync.id}
						</Text>
					</LabeledContent>
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<Button
						label="Copy Sync ID"
						systemImage="doc.on.doc"
						onPress={() => model.copy(sync.id)}
					/>
				</ContextMenu.Items>
			</ContextMenu>
		</DetailSection>
	);
}

export function GitOpsSyncDetailScreen() {
	const model = useGitOpsSyncDetail();
	const error = model.visibleError;
	return (
		<>
			<Stack.Screen options={{ title: model.sync.name, headerLargeTitleEnabled: false }} />
			<ResourceActionsToolbar
				primary={model.syncAction}
				overflow={model.overflowActions}
				runningItemID={model.runningActionID}
				isDisabled={model.runningActionID !== undefined}
				resourceName={model.sync.name}
			/>
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped'), refreshable(model.reload)]}>
					<Section>
						<Header model={model} />
					</Section>
					{error !== undefined ? <ErrorSection model={model} error={error} /> : null}
					<SourceSection model={model} />
					{model.isBackup ? (
						<>
							<BackupSection model={model} />
							<BackupPathsSection model={model} />
						</>
					) : (
						<>
							<LastSyncSection model={model} />
							<AutomationSection model={model} />
							<PreDeploySection model={model} />
						</>
					)}
					<SyncedFilesSection model={model} />
					<DetailsSection model={model} />
				</List>
			</Host>
		</>
	);
}
