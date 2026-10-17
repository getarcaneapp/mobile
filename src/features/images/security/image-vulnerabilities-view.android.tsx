/**
 * Android rendering of `ImageVulnerabilitiesView` (ImageVulnerabilitiesView.swift):
 * the same summary, filter chips, re-scan, and paginated findings as a
 * Material 3 grouped list. The admin context menu becomes the row's
 * long-press menu.
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { CenteredMessage } from '@/features/containers/android-material';
import { LongPressMenu } from '@/features/containers/long-press-menu';
import { colors, systemColors } from '@/theme/colors';
import { ResourceCountSectionHeader, SectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
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

function EmptyMessage({ icon, title, message }: { icon: string; title: string; message: string }) {
	return (
		<View style={{ alignItems: 'center', padding: 32, paddingTop: 48, gap: 8 }}>
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
	const items = model.isAdmin
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
		: [];
	return (
		<LongPressMenu
			items={items}
			title={vulnerability.vulnerabilityId}
			onPress={() => model.openDetail(vulnerability)}
			style={{ paddingHorizontal: 16, paddingVertical: 10 }}
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
		try {
			await model.reload();
		} finally {
			setRefreshing(false);
		}
	};
	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 24, paddingTop: 12, gap: 12 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => void onRefresh()}
					colors={[systemColors.blue]}
				/>
			}
		>
			{summary ? (
				<MaterialListGroup>
					<View style={{ padding: 16, gap: 10 }}>
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
				<View style={{ paddingVertical: 12, gap: 6 }}>
					<View style={{ paddingHorizontal: 12 }}>
						<SectionHeader title="Filter" systemImage="line.3.horizontal.decrease.circle" />
					</View>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 2 }}
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
							style={[m3Type.labelSmall, { color: colors.secondaryLabel, paddingHorizontal: 16 }]}
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

			{displayedVulnerabilities.length === 0 && !model.isLoading ? (
				<EmptyMessage
					icon="checkmark.shield"
					title="No vulnerabilities"
					message={
						summary === undefined
							? 'Run a scan to see results.'
							: 'Nothing matches the current filter.'
					}
				/>
			) : (
				<View>
					<ResourceCountSectionHeader
						title="Findings"
						loadedCount={displayedVulnerabilities.length}
					/>
					<MaterialListGroup>
						{displayedVulnerabilities.map((vulnerability) => (
							<VulnerabilityListRow
								key={vulnerability.id}
								model={model}
								vulnerability={vulnerability}
							/>
						))}
						<PaginatedListFooter
							hasMore={model.hasMore}
							loadMoreError={model.loadMoreError}
							onRetry={() => void model.loadMore()}
							onLoadMore={() => void model.loadMore()}
						/>
					</MaterialListGroup>
				</View>
			)}
		</ScrollView>
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
