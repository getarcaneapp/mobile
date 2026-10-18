import { Stack } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';
import { M3Section } from '@/features/containers/android-material';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { environmentDisplayName } from '@/stores/environments-store';
import { useAccentColor } from '@/theme/accent';
import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { EnvironmentLoadFailuresSection } from '@/ui/components/environment-label';
import {
	environmentActionIsMenu,
	environmentTitle,
	type ListEnvironment
} from '@/ui/components/environment-label.types';
import {
	GroupedFlashList,
	groupPosition,
	type GroupedListEntry
} from '@/ui/components/grouped-flash-list';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { SeverityBar } from '@/ui/components/severity-bar';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { GroupedRowSurface } from '@/ui/components/virtualized-sectioned-list';
import { MaterialListGroup, MaterialListItem, MaterialSectionHeader } from '@/ui/material/list';

import { SecurityOverview } from './security-overview';
import {
	useAllVulnerabilities,
	type AllVulnerabilitiesModel,
	type AllVulnerabilitiesProps,
	type FindingItem
} from './use-all-vulnerabilities';
import { VulnerabilityWithImageRow } from './vulnerability-rows';

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
	return (
		<View style={{ gap: 2 }}>
			<Text style={[m3Type.titleLarge, { fontWeight: '700', color }]}>{value}</Text>
			<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>{label}</Text>
		</View>
	);
}

function SummaryCard({ model }: { model: AllVulnerabilitiesModel }) {
	const accent = useAccentColor();
	const summary = model.summary;
	if (!summary) {
		return (
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
				<ActivityIndicator size="small" color={m3.primary as string} />
				<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel }]}>Loading…</Text>
			</View>
		);
	}
	const s = summary.summary;
	const secondary = colors.secondaryLabel as string;
	return (
		<View style={{ gap: 8, padding: 16 }}>
			<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
				<Metric label="Images" value={String(summary.totalImages)} color={secondary} />
				<Metric label="Scanned" value={String(summary.scannedImages)} color={accent} />
				{s ? (
					<Metric
						label="Total CVEs"
						value={String(s.total)}
						color={s.total > 0 ? systemColors.orange : secondary}
					/>
				) : null}
			</View>
			{s ? (
				<SeverityBar
					critical={s.critical}
					high={s.high}
					medium={s.medium}
					low={s.low}
					unknown={s.unknown}
				/>
			) : null}
		</View>
	);
}

const listRowStyle = { paddingHorizontal: 16, paddingVertical: 10 };
const listContentStyle = { paddingBottom: 24 };
const scrollStyle = { flex: 1 };

type FindingEntry = GroupedListEntry & ({ type: 'header' } | { type: 'item'; item: FindingItem });

function findingEntries(items: FindingItem[], hasMore: boolean) {
	const entries: FindingEntry[] = [{ type: 'header', key: 'header:findings' }];
	items.forEach((item, index) => {
		const position = groupPosition(index, items.length);
		entries.push({
			type: 'item',
			key: `finding:${item.id}`,
			item,
			grouped: { isFirst: position.isFirst, isLast: position.isLast && !hasMore }
		});
	});
	return entries;
}

function FindingListRow({ model, item }: { model: AllVulnerabilitiesModel; item: FindingItem }) {
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	return (
		<Pressable
			onPress={() => model.openFinding(item)}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={listRowStyle}
		>
			<VulnerabilityWithImageRow
				item={item.value}
				environmentName={item.environmentName}
				environmentColor={environmentColor}
			/>
		</Pressable>
	);
}

function OverviewContent({ model }: { model: AllVulnerabilitiesModel }) {
	if (model.overview) {
		return (
			<SecurityOverview
				key={model.overviewEnvironmentID}
				overview={model.overview}
				selectVulnerability={model.showVulnerability}
				openImage={model.openImageVulnerabilities}
			/>
		);
	}
	return (
		<M3Section title="Environment summary">
			<SummaryCard model={model} />
			{model.overviewError ? (
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingBottom: 12 }
					]}
				>
					{model.overviewError}
				</Text>
			) : null}
		</M3Section>
	);
}

function FindingsBanners({ model }: { model: AllVulnerabilitiesModel }) {
	const { snapshot } = model;
	return (
		<>
			<EnvironmentLoadFailuresSection
				failures={snapshot.failedEnvironments.map((failure) => ({
					...failure,
					id: failure.environment.id
				}))}
				retry={model.reload}
			/>
			{model.focusedVulnerabilityID !== undefined ? (
				<MaterialListGroup>
					<View
						style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 56 }}
					>
						<Text
							style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}
						>{`Showing ${model.focusedVulnerabilityID}`}</Text>
						<Pressable
							onPress={model.clearFocus}
							accessibilityRole="button"
							style={{ paddingHorizontal: 16, paddingVertical: 12 }}
						>
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Clear</Text>
						</Pressable>
					</View>
				</MaterialListGroup>
			) : null}
			{model.exportURI !== undefined ? (
				<MaterialListGroup>
					<MaterialListItem
						headline="Share exported CSV"
						icon="square.and.arrow.up"
						iconColor={m3.primary}
						onPress={model.shareExport}
					/>
				</MaterialListGroup>
			) : null}
		</>
	);
}

function FindingsEmptyContent({ model }: { model: AllVulnerabilitiesModel }) {
	return (
		<View style={{ gap: 12 }}>
			<FindingsBanners model={model} />
			{!model.snapshot.isLoading ? (
				<View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
					<Icon name="checkmark.shield" size={44} color={colors.secondaryLabel} />
					<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>
						No vulnerabilities
					</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
						Either no images have been scanned, or all findings have been filtered out.
					</Text>
				</View>
			) : null}
		</View>
	);
}

function FindingsList({
	model,
	refreshControl
}: {
	model: AllVulnerabilitiesModel;
	refreshControl: ReactElement;
}) {
	const { snapshot, displayedItems } = model;
	const hasBanners =
		snapshot.failedEnvironments.length > 0 ||
		model.focusedVulnerabilityID !== undefined ||
		model.exportURI !== undefined;
	return (
		<GroupedFlashList
			data={findingEntries(displayedItems, snapshot.hasMore)}
			renderEntry={(entry) =>
				entry.type === 'header' ? (
					<MaterialSectionHeader title="Findings" />
				) : (
					<FindingListRow model={model} item={entry.item} />
				)
			}
			header={
				<View style={{ gap: 12, paddingBottom: hasBanners ? 12 : 0 }}>
					<FindingsBanners model={model} />
				</View>
			}
			footer={
				snapshot.hasMore ? (
					<GroupedRowSurface isFirst={false} isLast>
						<PaginatedListFooter
							hasMore={snapshot.hasMore}
							loadMoreError={snapshot.loadMoreError}
							onRetry={model.loadMore}
							onLoadMore={model.loadMore}
						/>
					</GroupedRowSurface>
				) : null
			}
			onEndReached={
				snapshot.hasMore && snapshot.loadMoreError === undefined ? model.loadMore : undefined
			}
			refreshControl={refreshControl}
			contentContainerStyle={listContentStyle}
		/>
	);
}

function environmentItem(
	id: string,
	title: string,
	icon: string,
	environments: ListEnvironment[],
	action: (environmentID: string) => void,
	disabled = false
): AndroidToolbarItem | undefined {
	const first = environments[0];
	if (environmentActionIsMenu(environments)) {
		return {
			kind: 'menu',
			id,
			icon,
			label: title,
			disabled,
			items: environments.map((environment) => ({
				id: environment.id,
				title: environmentTitle(environment),
				onPress: () => action(environment.id)
			}))
		};
	}
	if (!first) return undefined;
	return { kind: 'button', id, icon, label: title, disabled, onPress: () => action(first.id) };
}

function SecurityToolbar({ model }: { model: AllVulnerabilitiesModel }) {
	const { toolbar } = model;
	const items: (AndroidToolbarItem | undefined)[] = [];
	if (toolbar.showsPatchEnvironmentAction) {
		items.push(
			environmentItem(
				'patch',
				'Patch images',
				'wrench.and.screwdriver',
				model.patchEnvironments,
				model.openPatchTargets
			)
		);
	}
	if (toolbar.showsPatchLink) {
		items.push({
			kind: 'button',
			id: 'patch',
			icon: 'wrench.and.screwdriver',
			label: 'Patch images',
			onPress: () => model.openPatchTargets(model.environmentID)
		});
	}
	if (toolbar.showsOverviewEnvironmentPicker) {
		items.push({
			kind: 'menu',
			id: 'environment',
			icon: 'server.rack',
			label: 'Environment',
			items: model.enabledEnvironments.map((environment) => ({
				id: environment.id,
				title: environmentDisplayName(environment),
				checked: environment.id === model.overviewEnvironmentID,
				onPress: () => model.selectOverviewEnvironment(environment.id)
			}))
		});
	}
	if (toolbar.showsFindingsActions) {
		items.push({
			kind: 'button',
			id: 'filter',
			icon:
				model.filterCount > 0
					? 'line.3.horizontal.decrease.circle.fill'
					: 'line.3.horizontal.decrease.circle',
			label: 'Filter vulnerabilities',
			onPress: model.openFilter
		});
		items.push(
			model.allEnvironments
				? environmentItem(
						'export',
						'Export CSV',
						'square.and.arrow.up',
						model.exportEnvironments,
						model.exportCSV,
						toolbar.exportDisabled
					)
				: {
						kind: 'button',
						id: 'export',
						icon: 'square.and.arrow.up',
						label: 'Export vulnerabilities as CSV',
						disabled: toolbar.exportDisabled,
						onPress: () => model.exportCSV(model.environmentID)
					}
		);
	}
	return (
		<AndroidToolbar
			items={items.filter((item): item is AndroidToolbarItem => item !== undefined)}
		/>
	);
}

export function AllVulnerabilitiesView(props: AllVulnerabilitiesProps) {
	const model = useAllVulnerabilities(props);
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
	return (
		<>
			<Stack.Screen options={{ title: 'Security' }} />
			<SecurityToolbar model={model} />
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<ScrollableTabBar
					selection={model.selectedSection}
					onSelectionChange={model.setSelectedSection}
					options={model.sectionOptions}
					accessibilityLabel="Security sections"
				/>
				{model.selectedSection !== 'overview' && model.displayedItems.length > 0 ? (
					<FindingsList model={model} refreshControl={refreshControl} />
				) : (
					<ScrollView
						style={scrollStyle}
						contentContainerStyle={listContentStyle}
						refreshControl={refreshControl}
					>
						{model.selectedSection === 'overview' ? (
							<OverviewContent model={model} />
						) : (
							<FindingsEmptyContent model={model} />
						)}
					</ScrollView>
				)}
			</View>
		</>
	);
}
