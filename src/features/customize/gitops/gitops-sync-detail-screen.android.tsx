import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { formatDate } from '@/core/date-formatting';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { withCleanup } from '@/core/with-cleanup';
import { relativeNamed } from '@/features/dashboard/use-all-environments-dashboard';
import { AndroidResourceActionsToolbar } from '@/features/settings/shared/android-toolbar';
import { TextButtonRow, ValueRow } from '@/features/settings/shared/android-material';
import { LongPressMenu } from '@/features/settings/shared/long-press-menu';
import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { capitalized } from '@/ui/components/resource-status';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { useGitOpsSyncDetail, type GitOpsSyncDetailModel } from './use-gitops-sync-detail';

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	minHeight: 48,
	paddingHorizontal: 16,
	paddingVertical: 10
};

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
		<View>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 8,
					paddingHorizontal: 16,
					paddingTop: 20,
					paddingBottom: 6
				}}
			>
				<Icon name={systemImage} size={16} color={colors.secondaryLabel} />
				<Text
					accessibilityRole="header"
					style={[m3Type.titleSmall, { color: colors.secondaryLabel }]}
				>
					{title}
				</Text>
			</View>
			<MaterialListGroup>{children}</MaterialListGroup>
			{footer ? (
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
					]}
				>
					{footer}
				</Text>
			) : null}
		</View>
	);
}

function LabeledRow({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View style={rowStyle}>
			<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{title}</Text>
			<View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
		</View>
	);
}

function Mono({ value, lines }: { value: string; lines: number }) {
	return (
		<Text
			numberOfLines={lines}
			ellipsizeMode="middle"
			style={[
				m3Type.bodyMedium,
				{ color: colors.secondaryLabel, fontFamily: monoFamily, textAlign: 'right' }
			]}
		>
			{value}
		</Text>
	);
}

function DateRow({ label, date }: { label: string; date?: Date }) {
	return (
		<LabeledRow title={label}>
			{date ? (
				<View style={{ alignItems: 'flex-end', gap: 2 }}>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						{relativeNamed(date.getTime())}
					</Text>
					<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>
						{formatDate(date, 'abbreviated', 'shortened')}
					</Text>
				</View>
			) : (
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>Never</Text>
			)}
		</LabeledRow>
	);
}

function PathRow({ path }: { path: string }) {
	return (
		<View style={rowStyle}>
			<Icon
				name={path.endsWith('/') ? 'folder' : 'doc.text'}
				size={20}
				color={colors.secondaryLabel}
			/>
			<Text
				numberOfLines={2}
				ellipsizeMode="middle"
				style={[m3Type.bodyMedium, { color: colors.label, fontFamily: monoFamily, flex: 1 }]}
			>
				{path}
			</Text>
		</View>
	);
}

function CommitRow({ model }: { model: GitOpsSyncDetailModel }) {
	const commit = model.sync.lastSyncCommit;
	const short = model.shortCommit;
	if (commit === undefined || short === undefined) return null;
	const commitURL = model.commitURL;
	const items = [{ id: 'copy', title: 'Copy Commit Hash', onPress: () => model.copy(commit) }];
	if (commitURL)
		items.push({ id: 'open', title: 'Open Commit', onPress: () => model.openURL(commitURL) });
	return (
		<LongPressMenu
			items={items}
			title="Commit"
			onPress={commitURL ? () => model.openURL(commitURL) : undefined}
			style={rowStyle}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label }]}>Commit</Text>
			<Text
				style={[
					m3Type.bodyLarge,
					{
						flex: 1,
						textAlign: 'right',
						fontFamily: monoFamily,
						color: commitURL ? m3.primary : colors.secondaryLabel
					}
				]}
			>
				{short}
			</Text>
		</LongPressMenu>
	);
}

function Header({ model }: { model: GitOpsSyncDetailModel }) {
	const { sync, isBackup, status } = model;
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}>
			<View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
				<Icon
					name={isBackup ? 'arrow.up.doc.fill' : 'arrow.triangle.merge'}
					size={30}
					color={systemColors.indigo}
				/>
			</View>
			<View style={{ flex: 1, alignItems: 'flex-start', gap: 4 }}>
				<Text style={[m3Type.titleLarge, { color: colors.label }]}>{sync.name}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{isBackup ? 'Backs up to Git' : 'Deploys from Git'}
				</Text>
				<View style={{ paddingTop: 2 }}>
					<ResourceStatusBadge status={status.status} usesCardStyle label={status.label} />
				</View>
			</View>
		</View>
	);
}

function SyncedFiles({ model }: { model: GitOpsSyncDetailModel }) {
	const [expanded, setExpanded] = useState(false);
	const files = model.sync.syncedFiles;
	if (files.length === 0) return null;
	return (
		<View style={{ paddingTop: 20 }}>
			<MaterialListGroup>
				<Pressable
					onPress={() => setExpanded((value) => !value)}
					accessibilityRole="button"
					accessibilityState={{ expanded }}
					android_ripple={{ color: colors.separator as string }}
					style={rowStyle}
				>
					<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
						{model.isBackup ? 'Files in Last Backup' : 'Synced Files'}
					</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						{String(files.length)}
					</Text>
					<Icon
						name={expanded ? 'chevron.up' : 'chevron.down'}
						size={18}
						color={colors.secondaryLabel}
					/>
				</Pressable>
				{expanded ? files.map((path) => <PathRow key={path} path={path} />) : null}
			</MaterialListGroup>
		</View>
	);
}

export function GitOpsSyncDetailScreen() {
	const model = useGitOpsSyncDetail();
	const { sync, isBackup } = model;
	const [refreshing, setRefreshing] = useState(false);
	const error = model.visibleError;
	const preDeployStatus = sync.preDeployLastRunStatus;
	const repositoryWebURL = model.repositoryWebURL;

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			() => model.reload(),
			() => setRefreshing(false)
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: sync.name }} />
			<AndroidResourceActionsToolbar
				primary={model.syncAction}
				overflow={model.overflowActions}
				runningItemID={model.runningActionID}
				isDisabled={model.runningActionID !== undefined}
				resourceName={sync.name}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				<View style={{ paddingTop: 12 }}>
					<MaterialListGroup>
						<Header model={model} />
					</MaterialListGroup>
				</View>

				{error !== undefined ? (
					<DetailSection
						title={isBackup ? 'Backup Error' : 'Sync Error'}
						systemImage="exclamationmark.triangle"
					>
						<Text selectable style={[m3Type.bodyMedium, { color: systemColors.red, padding: 16 }]}>
							{error}
						</Text>
						{isBackup && model.backupFailureDescription !== undefined ? (
							<ValueRow title="Reason" value={model.backupFailureDescription} />
						) : null}
					</DetailSection>
				) : null}

				<DetailSection title="Repository" systemImage="externaldrive.connected.to.line.below">
					<ValueRow
						title="Repository"
						value={sync.repositoryName ?? sync.repositoryURL ?? 'Unknown'}
					/>
					{sync.repositoryName !== undefined && sync.repositoryURL !== undefined ? (
						<LabeledRow title="URL">
							<Mono value={sync.repositoryURL} lines={1} />
						</LabeledRow>
					) : null}
					{sync.branch !== undefined ? (
						<LabeledRow title="Branch">
							<Mono value={sync.branch} lines={1} />
						</LabeledRow>
					) : null}
					{isBackup ? (
						<LabeledRow title="Backup Directory">
							<Mono value={sync.backupDirectory ?? '/'} lines={2} />
						</LabeledRow>
					) : sync.composePath !== undefined ? (
						<LabeledRow title="Compose File">
							<Mono value={sync.composePath} lines={2} />
						</LabeledRow>
					) : null}
					{model.projectLinks ? (
						<Pressable
							onPress={model.openProject}
							accessibilityRole="button"
							android_ripple={{ color: colors.separator as string }}
							style={rowStyle}
						>
							<Text style={[m3Type.bodyLarge, { color: colors.label }]}>Project</Text>
							<Text
								style={[
									m3Type.bodyMedium,
									{ flex: 1, textAlign: 'right', color: colors.secondaryLabel }
								]}
							>
								{sync.projectName ?? 'Not created yet'}
							</Text>
							<Icon name="chevron.right" size={18} color={colors.tertiaryLabel} />
						</Pressable>
					) : (
						<ValueRow title={model.targetLabel} value={sync.projectName ?? 'Not created yet'} />
					)}
					{repositoryWebURL !== undefined ? (
						<TextButtonRow
							title="Open Repository"
							onPress={() => model.openURL(repositoryWebURL)}
						/>
					) : null}
				</DetailSection>

				{isBackup ? (
					<>
						<DetailSection title="Backup" systemImage="arrow.up.doc">
							<LabeledRow title="State">
								<ResourceStatusBadge status={model.status.status} label={model.status.label} />
							</LabeledRow>
							<DateRow label="Last Backup" date={sync.lastBackupAt} />
							<DateRow label="Last Check" date={sync.lastSyncAt} />
							<CommitRow model={model} />
							<ValueRow title="Trigger" value={sync.backupOnSave ? 'On Save' : 'Manual'} />
							{sync.backupPending ? (
								<ValueRow title="Pending Changes" value="Waiting to push" />
							) : null}
						</DetailSection>
						<DetailSection
							title="Backup Paths"
							systemImage="folder"
							footer="Compose files are always included."
						>
							{sync.backupPaths.length === 0 ? (
								<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel, padding: 16 }]}>
									Compose files only
								</Text>
							) : (
								sync.backupPaths.map((path) => <PathRow key={path} path={path} />)
							)}
						</DetailSection>
					</>
				) : (
					<>
						<DetailSection title="Last Sync" systemImage="clock.arrow.circlepath">
							<LabeledRow title="Status">
								<ResourceStatusBadge status={model.status.status} label={model.status.label} />
							</LabeledRow>
							<DateRow label="Synced" date={sync.lastSyncAt} />
							<CommitRow model={model} />
						</DetailSection>
						<DetailSection title="Automation" systemImage="gearshape.2">
							<ValueRow
								title="Auto Sync"
								value={sync.autoSync ? model.syncIntervalDescription : 'Off'}
							/>
							<ValueRow
								title="Sync Scope"
								value={sync.syncDirectory ? 'Entire directory' : 'Compose file only'}
							/>
							<ValueRow
								title="Pull Images After Sync"
								value={sync.pullImageAfterSync ? 'On' : 'Off'}
							/>
							<ValueRow title="Redeploy After Sync" value={sync.redeployAfterSync ? 'On' : 'Off'} />
						</DetailSection>
						{sync.preDeployScriptPath !== undefined ? (
							<DetailSection title="Pre-Deploy Hook" systemImage="terminal">
								<LabeledRow title="Script">
									<Mono value={sync.preDeployScriptPath} lines={2} />
								</LabeledRow>
								{sync.preDeployRunnerImage !== undefined ? (
									<LabeledRow title="Runner Image">
										<Mono value={sync.preDeployRunnerImage} lines={1} />
									</LabeledRow>
								) : null}
								{preDeployStatus !== undefined ? (
									<LabeledRow title="Last Run">
										<ResourceStatusBadge
											status={preDeployStatus === 'timeout' ? 'failed' : preDeployStatus}
											label={capitalized(preDeployStatus)}
										/>
									</LabeledRow>
								) : null}
								{sync.preDeployLastRunAt !== undefined ? (
									<DateRow label="Ran" date={sync.preDeployLastRunAt} />
								) : null}
							</DetailSection>
						) : null}
					</>
				)}

				<SyncedFiles model={model} />

				<DetailSection title="Details" systemImage="info.circle">
					{model.environmentName !== undefined ? (
						<ValueRow title="Environment" value={model.environmentName} />
					) : null}
					{sync.maxSyncFiles > 0 ? (
						<ValueRow title="File Limit" value={String(sync.maxSyncFiles)} />
					) : null}
					{sync.maxSyncTotalSize > 0 ? (
						<ValueRow title="Total Size Limit" value={formatFileBytes(sync.maxSyncTotalSize)} />
					) : null}
					{sync.maxSyncBinarySize > 0 ? (
						<ValueRow title="Binary File Limit" value={formatFileBytes(sync.maxSyncBinarySize)} />
					) : null}
					{sync.createdAt ? (
						<ValueRow
							title="Created"
							value={formatDate(sync.createdAt, 'abbreviated', 'shortened')}
						/>
					) : null}
					{sync.updatedAt ? (
						<ValueRow
							title="Updated"
							value={formatDate(sync.updatedAt, 'abbreviated', 'shortened')}
						/>
					) : null}
					<LongPressMenu
						items={[{ id: 'copy', title: 'Copy Sync ID', onPress: () => model.copy(sync.id) }]}
						title="Sync ID"
						style={rowStyle}
					>
						<Text style={[m3Type.bodyLarge, { color: colors.label }]}>Sync ID</Text>
						<Text
							numberOfLines={1}
							ellipsizeMode="middle"
							style={[
								m3Type.bodySmall,
								{
									flex: 1,
									textAlign: 'right',
									fontFamily: monoFamily,
									color: colors.secondaryLabel
								}
							]}
						>
							{sync.id}
						</Text>
					</LongPressMenu>
				</DetailSection>
			</ScrollView>
		</>
	);
}
