/**
 * Android rendering of `UpdaterHistoryView` and `UpdaterHistoryDetailView`
 * (UpdaterHistoryView.swift): Material 3 list with search, pull-to-refresh,
 * pagination, and a pushed detail page.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { M3Section, ValueRow } from '@/features/containers/android-material';
import { formatDate } from '@/core/date-formatting';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { AutoUpdateRecord } from '@/sdk/models/updater/Updater';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import {
	abbreviatedDuration,
	capitalized,
	flattenVersions,
	historyBadgeTint,
	imageChange,
	relativeNamed,
	resourceTypeIcon,
	resourceTypeTint,
	updaterStatusText,
	updaterStatusTint
} from './updates-logic';
import { updaterHistoryRecords, useUpdatesNavigation } from './updates-routes';
import { useUpdaterHistory } from './use-updater-history';

function UpdaterStatusBadge({ text, tint }: { text: string; tint: string }) {
	return (
		<Text
			style={[
				m3Type.labelSmall,
				{
					color: tint,
					fontWeight: '700',
					paddingHorizontal: 8,
					paddingVertical: 3,
					borderRadius: 999,
					overflow: 'hidden',
					backgroundColor: withOpacity(tint, 0.15)
				}
			]}
		>
			{text}
		</Text>
	);
}

function UpdaterHistoryRow({ record, onPress }: { record: AutoUpdateRecord; onPress: () => void }) {
	const change = imageChange(
		flattenVersions(record.oldImageVersions),
		flattenVersions(record.newImageVersions)
	);
	const started = parseArcaneDate(record.startTime);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingHorizontal: 16,
				paddingVertical: 12
			}}
		>
			<RowIcon
				systemImage={resourceTypeIcon(record.resourceType)}
				tint={resourceTypeTint(record.resourceType)}
			/>
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label }]} numberOfLines={1}>
					{record.resourceName}
				</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]} numberOfLines={1}>
					{`${capitalized(record.resourceType)}  •  ${started ? relativeNamed(started.getTime()) : record.startTime}`}
				</Text>
				{change !== undefined ? (
					<Text
						style={[m3Type.labelSmall, { color: colors.tertiaryLabel, fontFamily: monoFamily }]}
						numberOfLines={1}
						ellipsizeMode="middle"
					>
						{change}
					</Text>
				) : null}
			</View>
			<UpdaterStatusBadge
				text={updaterStatusText(record)}
				tint={updaterStatusTint(record, false)}
			/>
		</Pressable>
	);
}

function CenteredState({
	icon,
	title,
	message
}: {
	icon: string;
	title: string;
	message?: string;
}) {
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			{message ? (
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{message}
				</Text>
			) : null}
		</View>
	);
}

export function UpdaterHistoryScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useUpdaterHistory(envID);
	const navigation = useUpdatesNavigation();
	const [refreshing, setRefreshing] = useState(false);

	let content: ReactNode;
	if (model.isLoading && model.records.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading updater history…" />
			</View>
		);
	} else if (model.errorMessage !== undefined && model.records.length === 0) {
		content = (
			<CenteredState
				icon="exclamationmark.triangle"
				title="Couldn't Load History"
				message={model.errorMessage}
			/>
		);
	} else if (model.records.length === 0) {
		content = <CenteredState icon="clock.arrow.circlepath" title="No Update History" />;
	} else {
		content = (
			<View style={{ paddingTop: 12 }}>
				<MaterialListGroup>
					{model.displayedRecords.map((record) => (
						<UpdaterHistoryRow
							key={record.id}
							record={record}
							onPress={() => navigation.openHistoryRecord(envID, record)}
						/>
					))}
				</MaterialListGroup>
				<PaginatedListFooter
					hasMore={model.hasMore && model.searchText === ''}
					loadMoreError={model.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Updater History',
					headerSearchBarOptions: {
						placeholder: 'Search updater history',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'refresh',
						icon: 'arrow.clockwise',
						label: 'Refresh',
						disabled: model.isLoading,
						onPress: () => void model.load(true)
					}
				]}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.load(true).finally(() => setRefreshing(false));
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

export function UpdaterHistoryDetailScreen() {
	const { key, title } = useLocalSearchParams<{ key?: string; title?: string }>();
	const record = updaterHistoryRecords.get(key);
	if (!record) {
		return (
			<>
				<Stack.Screen options={{ title: title ?? '' }} />
				<CenteredState icon="exclamationmark.triangle" title="Record Unavailable" />
			</>
		);
	}
	const started = parseArcaneDate(record.startTime);
	const ended = record.endTime !== undefined ? parseArcaneDate(record.endTime) : undefined;
	const duration = started && ended ? (ended.getTime() - started.getTime()) / 1000 : 0;
	const oldVersions = flattenVersions(record.oldImageVersions);
	const newVersions = flattenVersions(record.newImageVersions);
	const allKeys = [...new Set([...Object.keys(oldVersions), ...Object.keys(newVersions)])].sort();

	return (
		<>
			<Stack.Screen options={{ title: record.resourceName }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section>
					<ValueRow title="Resource" value={record.resourceName} />
					<ValueRow title="Type" value={capitalized(record.resourceType)} />
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							minHeight: 56,
							paddingHorizontal: 16
						}}
					>
						<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>Status</Text>
						<UpdaterStatusBadge text={updaterStatusText(record)} tint={historyBadgeTint(record)} />
					</View>
					<ValueRow title="Update Applied" value={record.updateApplied ? 'Yes' : 'No'} />
					<ValueRow title="Update Available" value={record.updateAvailable ? 'Yes' : 'No'} />
				</M3Section>
				<M3Section title="Timing">
					<ValueRow
						title="Started"
						value={started ? formatDate(started, 'abbreviated', 'standard') : record.startTime}
					/>
					{ended ? (
						<ValueRow title="Ended" value={formatDate(ended, 'abbreviated', 'standard')} />
					) : null}
					{ended && duration > 0 ? (
						<ValueRow title="Duration" value={abbreviatedDuration(duration)} />
					) : null}
				</M3Section>
				{record.error !== undefined && record.error !== '' ? (
					<M3Section title="Error">
						<Text selectable style={[m3Type.bodyMedium, { color: systemColors.red, padding: 16 }]}>
							{record.error}
						</Text>
					</M3Section>
				) : null}
				{allKeys.length > 0 ? (
					<M3Section title="Image Versions">
						{allKeys.map((versionKey) => (
							<View key={versionKey} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 4 }}>
								<Text
									style={[
										m3Type.bodySmall,
										{ color: colors.secondaryLabel, fontFamily: monoFamily }
									]}
								>
									{versionKey}
								</Text>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
									<Text
										style={[
											m3Type.bodySmall,
											{ color: colors.secondaryLabel, fontFamily: monoFamily }
										]}
									>
										{oldVersions[versionKey] ?? '—'}
									</Text>
									<Icon name="arrow.right" size={12} color={colors.tertiaryLabel} />
									<Text style={[m3Type.bodySmall, { color: colors.label, fontFamily: monoFamily }]}>
										{newVersions[versionKey] ?? '—'}
									</Text>
								</View>
							</View>
						))}
					</M3Section>
				) : null}
				<M3Section title="Identifiers">
					<ValueRow title="Resource ID" value={record.resourceId} monospaced />
					<ValueRow title="Record ID" value={record.id} monospaced />
				</M3Section>
			</ScrollView>
		</>
	);
}
