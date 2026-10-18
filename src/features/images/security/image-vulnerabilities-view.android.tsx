import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { CenteredMessage } from '@/features/containers/android-material';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import {
	GroupedFlashList,
	groupPosition,
	type GroupedListEntry
} from '@/ui/components/grouped-flash-list';
import { ResourceCountSectionHeader, SectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { GroupedRowSurface } from '@/ui/components/virtualized-sectioned-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import {
	useImageVulnerabilities,
	type ImageVulnerabilitiesModel,
	type ImageVulnerabilitiesProps
} from './use-image-vulnerabilities';
import {
	IgnoredChip,
	SeverityFilterChip,
	SeveritySummaryRow,
	VulnerabilityRow
} from './vulnerability-rows';
import { VulnerabilitySeverities, type VulnerabilityRecord } from './vulnerability-model';

const emptyStyle = { alignItems: 'center' as const, padding: 32, paddingTop: 48, gap: 8 };
const listRowStyle = { paddingHorizontal: 16, paddingVertical: 10 };
const listContentStyle = { paddingBottom: 24, paddingTop: 12 };
const summaryStyle = { padding: 16, gap: 10 };
const filterStyle = { paddingVertical: 12, gap: 6 };
const filterHeaderStyle = { paddingHorizontal: 12 };
const chipsContentStyle = { gap: 8, paddingHorizontal: 16, paddingVertical: 2 };
const noMenuItems: RowMenuItem[] = [];

type FindingEntry = GroupedListEntry &
	({ type: 'header' } | { type: 'item'; vulnerability: VulnerabilityRecord });

function findingEntries(vulnerabilities: VulnerabilityRecord[], hasMore: boolean) {
	const entries: FindingEntry[] = [{ type: 'header', key: 'header:findings' }];
	vulnerabilities.forEach((vulnerability, index) => {
		const position = groupPosition(index, vulnerabilities.length);
		entries.push({
			type: 'item',
			key: `finding:${vulnerability.id}`,
			vulnerability,
			grouped: { isFirst: position.isFirst, isLast: position.isLast && !hasMore }
		});
	});
	return entries;
}

function EmptyMessage({ icon, title, message }: { icon: string; title: string; message: string }) {
	return (
		<View style={emptyStyle}>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
				{message}
			</Text>
		</View>
	);
}

function VulnerabilityListRow({
	model,
	vulnerability
}: {
	model: ImageVulnerabilitiesModel;
	vulnerability: VulnerabilityRecord;
}) {
	const ignore = model.ignoreInfo(vulnerability);
	const items: RowMenuItem[] = model.isAdmin
		? ignore
			? [{ id: 'unignore', title: 'Unignore', onPress: () => model.unignore(vulnerability) }]
			: [
					{
						id: 'ignore',
						title: 'Ignore',
						destructive: true,
						onPress: () => model.requestIgnore(vulnerability)
					}
				]
		: noMenuItems;
	return (
		<LongPressMenu
			items={items}
			title={vulnerability.vulnerabilityId}
			onPress={() => model.openDetail(vulnerability)}
			style={listRowStyle}
		>
			<VulnerabilityRow record={vulnerability} isIgnored={ignore !== undefined} />
		</LongPressMenu>
	);
}

function ScanList({ model }: { model: ImageVulnerabilitiesModel }) {
	const { summary, displayedVulnerabilities } = model;
	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(model.reload, () => setRefreshing(false));
	};
	const isEmpty = displayedVulnerabilities.length === 0 && !model.isLoading;
	return (
		<GroupedFlashList
			data={isEmpty ? [] : findingEntries(displayedVulnerabilities, model.hasMore)}
			renderEntry={(entry) =>
				entry.type === 'header' ? (
					<ResourceCountSectionHeader
						title="Findings"
						loadedCount={displayedVulnerabilities.length}
					/>
				) : (
					<VulnerabilityListRow model={model} vulnerability={entry.vulnerability} />
				)
			}
			header={
				<View style={{ gap: 12, paddingBottom: isEmpty ? 0 : 12 }}>
					{summary ? (
						<MaterialListGroup>
							<View style={summaryStyle}>
								<SectionHeader title="Summary" systemImage="chart.bar.doc.horizontal" />
								<SeveritySummaryRow
									summary={summary.summary}
									scanTime={summary.scanTime}
									status={summary.status}
									error={summary.error}
								/>
							</View>
						</MaterialListGroup>
					) : null}

					<MaterialListGroup>
						<View style={filterStyle}>
							<View style={filterHeaderStyle}>
								<SectionHeader title="Filter" systemImage="line.3.horizontal.decrease.circle" />
							</View>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={chipsContentStyle}
							>
								{VulnerabilitySeverities.map((severity) => (
									<SeverityFilterChip
										key={severity}
										severity={severity}
										isActive={
											model.selectedSeverities.length === 0 ||
											model.selectedSeverities.includes(severity)
										}
										onPress={() => model.toggleSeverity(severity)}
									/>
								))}
								<IgnoredChip showIgnored={model.showIgnored} onPress={model.toggleShowIgnored} />
							</ScrollView>
							{model.selectedSeverities.length > 0 ? (
								<Text
									style={[
										m3Type.labelSmall,
										{ color: colors.secondaryLabel, paddingHorizontal: 16 }
									]}
								>
									Showing only selected severities.
								</Text>
							) : null}
						</View>
					</MaterialListGroup>

					<MaterialListGroup>
						<Pressable
							onPress={() => void model.runScan()}
							disabled={model.isScanning}
							accessibilityRole="button"
							android_ripple={{ color: colors.separator as string }}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 12,
								padding: 16,
								opacity: model.isScanning ? 0.6 : 1
							}}
						>
							<Icon name="magnifyingglass" size={20} color={m3.primary} />
							<Text style={[m3Type.labelLarge, { color: m3.primary, flex: 1 }]}>
								{model.isScanning ? 'Scanning…' : 'Re-scan now'}
							</Text>
							{model.isScanning ? (
								<ActivityIndicator size="small" color={m3.primary as string} />
							) : null}
						</Pressable>
					</MaterialListGroup>

					{isEmpty ? (
						<EmptyMessage
							icon="checkmark.shield"
							title="No vulnerabilities"
							message={
								summary === undefined
									? 'Run a scan to see results.'
									: 'Nothing matches the current filter.'
							}
						/>
					) : null}
				</View>
			}
			footer={
				!isEmpty && model.hasMore ? (
					<GroupedRowSurface isFirst={displayedVulnerabilities.length === 0} isLast>
						<PaginatedListFooter
							hasMore={model.hasMore}
							loadMoreError={model.loadMoreError}
							onRetry={() => void model.loadMore()}
							onLoadMore={() => void model.loadMore()}
						/>
					</GroupedRowSurface>
				) : null
			}
			onEndReached={
				model.hasMore && model.loadMoreError === undefined ? () => void model.loadMore() : undefined
			}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => void onRefresh()}
					colors={[systemColors.blue]}
				/>
			}
			contentContainerStyle={listContentStyle}
		/>
	);
}

export function ImageVulnerabilitiesView(props: ImageVulnerabilitiesProps) {
	const model = useImageVulnerabilities(props);
	const embedded = props.embedded ?? false;
	return (
		<View style={{ flex: 1 }}>
			{!embedded ? <Stack.Screen options={{ title: 'Vulnerabilities' }} /> : null}
			{!embedded && model.canPatch ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'patch',
							icon: 'wrench.and.screwdriver',
							label: 'Patch image',
							onPress: model.openPatch
						}
					]}
				/>
			) : null}
			{model.status !== undefined && !model.status.available ? (
				<CenteredMessage
					icon="shield.slash"
					title="Scanner unavailable"
					message="Trivy is not installed or reachable on the host. Install Trivy and reload to scan images."
					action={{ title: 'Reload', onPress: () => void model.initialLoad() }}
				/>
			) : (
				<ScanList model={model} />
			)}
		</View>
	);
}
