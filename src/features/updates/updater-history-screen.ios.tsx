import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	LabeledContent,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	buttonStyle,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	padding,
	refreshable,
	shapes,
	textSelection,
	truncationMode,
	contentShape
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { formatDate } from '@/core/date-formatting';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { AutoUpdateRecord } from '@/sdk/models/updater/Updater';
import { systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';

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
			modifiers={[
				font({ textStyle: 'caption2', weight: 'bold' }),
				foregroundStyle(tint),
				padding({ horizontal: 8, vertical: 3 }),
				background(withOpacity(tint, 0.15), shapes.capsule())
			]}
		>
			{text}
		</Text>
	);
}

const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

function UpdaterHistoryRow({ record }: { record: AutoUpdateRecord }) {
	const change = imageChange(
		flattenVersions(record.oldImageVersions),
		flattenVersions(record.newImageVersions)
	);
	const started = parseArcaneDate(record.startTime);
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 4 })]}>
			<RowIcon
				systemImage={resourceTypeIcon(record.resourceType)}
				tint={resourceTypeTint(record.resourceType)}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), lineLimit(1)]}>
					{record.resourceName}
				</Text>
				<HStack spacing={6}>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{capitalized(record.resourceType)}
					</Text>
					<Text modifiers={[font({ textStyle: 'caption' }), tertiary]}>•</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(1)
						]}
					>
						{started ? relativeNamed(started.getTime()) : record.startTime}
					</Text>
				</HStack>
				{change !== undefined ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2', design: 'monospaced' }),
							tertiary,
							lineLimit(1),
							truncationMode('middle')
						]}
					>
						{change}
					</Text>
				) : null}
			</VStack>
			<Spacer minLength={8} />
			<UpdaterStatusBadge
				text={updaterStatusText(record)}
				tint={updaterStatusTint(record, false)}
			/>
		</HStack>
	);
}

export function UpdaterHistoryScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useUpdaterHistory(envID);
	const navigation = useUpdatesNavigation();
	const icon = useToolbarIcons(['arrow.clockwise']);

	let content;
	if (model.isLoading && model.records.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading updater history…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && model.records.length === 0) {
		content = (
			<ContentUnavailableView
				title="Couldn't Load History"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
			/>
		);
	} else if (model.records.length === 0) {
		content = (
			<ContentUnavailableView title="No Update History" systemImage="clock.arrow.circlepath" />
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(() => model.load(true))]}>
				<List.ForEach
					data={model.displayedRecords}
					keyExtractor={stableItemKey}
					estimatedItemSize={64}
				>
					{({ item }) => (
						<Button
							onPress={() => navigation.openHistoryRecord(envID, item)}
							modifiers={[buttonStyle('plain')]}
						>
							<HStack modifiers={[contentShape(shapes.rectangle())]}>
								<UpdaterHistoryRow record={item} />
								<DisclosureChevron />
							</HStack>
						</Button>
					)}
				</List.ForEach>
				<PaginatedListFooter
					hasMore={model.hasMore && model.searchText === ''}
					loadMoreError={model.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Updater History',
					headerSearchBarOptions: {
						placeholder: 'Search updater history',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<AppToolbar>
				<Stack.Toolbar.Button
					icon={icon('arrow.clockwise')}
					accessibilityLabel="Refresh"
					disabled={model.isLoading}
					onPress={() => void model.load(true)}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}

function Value({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
	return (
		<LabeledContent
			label={label}
			modifiers={mono ? [font({ textStyle: 'caption', design: 'monospaced' })] : undefined}
		>
			<Text>{value}</Text>
		</LabeledContent>
	);
}

export function UpdaterHistoryDetailScreen() {
	const { key, title } = useLocalSearchParams<{ key?: string; title?: string }>();
	const record = updaterHistoryRecords.get(key);
	if (!record) {
		return (
			<>
				<Stack.Screen options={{ title: title ?? '', headerLargeTitleEnabled: false }} />
				<Host style={{ flex: 1 }}>
					<ContentUnavailableView
						title="Record Unavailable"
						systemImage="exclamationmark.triangle"
					/>
				</Host>
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
			<Stack.Screen options={{ title: record.resourceName, headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<Section>
						<Value label="Resource" value={record.resourceName} />
						<Value label="Type" value={capitalized(record.resourceType)} />
						<LabeledContent label="Status">
							<UpdaterStatusBadge
								text={updaterStatusText(record)}
								tint={historyBadgeTint(record)}
							/>
						</LabeledContent>
						<Value label="Update Applied" value={record.updateApplied ? 'Yes' : 'No'} />
						<Value label="Update Available" value={record.updateAvailable ? 'Yes' : 'No'} />
					</Section>
					<Section title="Timing">
						<Value
							label="Started"
							value={started ? formatDate(started, 'abbreviated', 'standard') : record.startTime}
						/>
						{ended ? (
							<Value label="Ended" value={formatDate(ended, 'abbreviated', 'standard')} />
						) : null}
						{ended && duration > 0 ? (
							<Value label="Duration" value={abbreviatedDuration(duration)} />
						) : null}
					</Section>
					{record.error !== undefined && record.error !== '' ? (
						<Section title="Error">
							<Text
								modifiers={[
									font({ textStyle: 'subheadline' }),
									foregroundStyle(systemColors.red),
									textSelection(true)
								]}
							>
								{record.error}
							</Text>
						</Section>
					) : null}
					{allKeys.length > 0 ? (
						<Section title="Image Versions">
							{allKeys.map((versionKey) => (
								<VStack
									key={versionKey}
									alignment="leading"
									spacing={4}
									modifiers={[padding({ vertical: 2 })]}
								>
									<Text
										modifiers={[
											font({ textStyle: 'caption', design: 'monospaced' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{versionKey}
									</Text>
									<HStack spacing={6}>
										<Text
											modifiers={[
												font({ textStyle: 'caption', design: 'monospaced' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' })
											]}
										>
											{oldVersions[versionKey] ?? '—'}
										</Text>
										<Image
											systemName="arrow.right"
											modifiers={[font({ textStyle: 'caption2' }), tertiary]}
										/>
										<Text
											modifiers={[
												font({ textStyle: 'caption', design: 'monospaced' }),
												foregroundStyle('primary')
											]}
										>
											{newVersions[versionKey] ?? '—'}
										</Text>
									</HStack>
								</VStack>
							))}
						</Section>
					) : null}
					<Section title="Identifiers">
						<Value label="Resource ID" value={record.resourceId} mono />
						<Value label="Record ID" value={record.id} mono />
					</Section>
				</List>
			</Host>
		</>
	);
}
