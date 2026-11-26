import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	Text,
	TextInput,
	View,
	type ColorValue
} from 'react-native';

import { SectionTitle } from '@/features/networks/android-parts';
import {
	AndroidToolbar,
	type AndroidToolbarItem
} from '@/features/settings/shared/android-toolbar';
import type {
	ActorDiagnostics,
	ActorTypeInfo,
	DiagnosticsSnapshot
} from '@/sdk/models/diagnostics/Diagnostics';
import type { WebSocketConnectionInfo } from '@/sdk/models/system/WebSocketMetrics';
import { colors, systemColors } from '@/theme/colors';
import {
	GroupedFlashList,
	groupPosition,
	type GroupedListEntry
} from '@/ui/components/grouped-flash-list';
import { m3 } from '@/ui/components/material-colors';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	actorRunsSummary,
	actorTypeCounts,
	connectionCounts,
	connectionKindLabel,
	diagnosticsTabs,
	filterGoroutineRows,
	filterLogRows,
	formatCount,
	formatDiagnosticTime,
	gcRows,
	goroutineRows,
	heapLegend,
	heapSegments,
	logLevelFilters,
	logTimeLabel,
	logTone,
	maxListedActorInstances,
	memoryRows,
	runtimeRows,
	type DiagnosticLogRow,
	type DiagnosticRow,
	type GoroutineGroupRow,
	type HeapSegments
} from './diagnostics-model';
import { useDiagnostics, useDiagnosticsValue, type DiagnosticsModel } from './use-diagnostics';

type EntryKind =
	| { kind: 'title'; title: string }
	| { kind: 'error'; message: string }
	| { kind: 'message'; message: string; color?: ColorValue }
	| { kind: 'loading' }
	| { kind: 'value'; row: DiagnosticRow }
	| { kind: 'heap'; segments: HeapSegments }
	| { kind: 'connection'; connection: WebSocketConnectionInfo }
	| { kind: 'actorType'; id: string; actor: ActorTypeInfo; expandable: boolean; expanded: boolean }
	| { kind: 'detail'; title: string; subtitle: string; detail?: string; color?: ColorValue }
	| { kind: 'goroutine'; id: string; row: GoroutineGroupRow; expanded: boolean }
	| { kind: 'log'; row: DiagnosticLogRow };

type Row = { key: string; type: string } & EntryKind;

type Entry = GroupedListEntry & EntryKind;

const mono = 'monospace';
const contentStyle = { paddingBottom: 32 };
const rowStyle = { paddingHorizontal: 16, paddingVertical: 12, gap: 4 };

function grouped<T extends Row>(items: T[]): Entry[] {
	return items.map(
		(item, index) => ({ ...item, grouped: groupPosition(index, items.length) }) as Entry
	);
}

function titleEntry(key: string, title: string): Entry {
	return { key, type: 'title', kind: 'title', title };
}

function statusEntries(key: string, error: string | undefined, isLoading: boolean): Entry[] {
	if (error)
		return grouped([{ key: `${key}-error`, type: 'error', kind: 'error', message: error }]);
	if (isLoading) return [{ key: `${key}-loading`, type: 'loading', kind: 'loading' }];
	return [];
}

function valueEntries(prefix: string, rows: DiagnosticRow[]): Entry[] {
	return grouped(
		rows.map((row) => ({
			key: `${prefix}-${row.label}`,
			type: 'value',
			kind: 'value' as const,
			row
		}))
	);
}

function overviewEntries(snapshotState: SnapshotState): Entry[] {
	const { snapshot, error } = snapshotState;
	const entries = statusEntries('overview', error, !snapshot);
	if (!snapshot) return entries;
	if (snapshot.runtime.leakedGoroutines > 0)
		entries.push(
			...grouped([
				{
					key: 'leaks',
					type: 'error',
					kind: 'error' as const,
					message: `${formatCount(snapshot.runtime.leakedGoroutines)} leaked goroutines`
				}
			])
		);
	const segments = heapSegments(snapshot.memory);
	return [
		...entries,
		titleEntry('runtime-title', 'Runtime'),
		...valueEntries('runtime', runtimeRows(snapshot)),
		titleEntry('memory-title', 'Memory'),
		...grouped([
			...(segments ? [{ key: 'heap', type: 'heap', kind: 'heap' as const, segments }] : []),
			...[...heapLegend(snapshot.memory), ...memoryRows(snapshot.memory)].map((row) => ({
				key: `memory-${row.label}`,
				type: 'value',
				kind: 'value' as const,
				row
			}))
		]),
		titleEntry('gc-title', 'Garbage Collector'),
		...valueEntries('gc', gcRows(snapshot))
	];
}

function connectionEntries(snapshotState: SnapshotState): Entry[] {
	const { snapshot, error } = snapshotState;
	const entries = statusEntries('connections', error, !snapshot);
	if (!snapshot) return entries;
	const connections = snapshot.websocket.connections;
	return [
		...entries,
		titleEntry('streams-title', 'Active Streams'),
		...valueEntries('streams', connectionCounts(snapshot)),
		titleEntry('connections-title', `Connections (${formatCount(connections.length)})`),
		...(connections.length === 0
			? grouped([
					{
						key: 'connections-empty',
						type: 'message',
						kind: 'message' as const,
						message: 'No active connections'
					}
				])
			: grouped(
					connections.map((connection) => ({
						key: `connection-${connection.id}`,
						type: 'connection',
						kind: 'connection' as const,
						connection
					}))
				))
	];
}

function actorTypeEntries(
	environment: ActorDiagnostics,
	type: ActorTypeInfo,
	expandedIDs: ReadonlySet<string>
): Row[] {
	const id = `${environment.environmentId}:${type.actorType}`;
	const expandable = type.instances.length > 0 || type.recentFailures.length > 0;
	const expanded = expandable && expandedIDs.has(id);
	const rows: Row[] = [
		{
			key: `type-${id}`,
			type: 'actorType',
			kind: 'actorType',
			id,
			actor: type,
			expandable,
			expanded
		}
	];
	if (!expanded) return rows;
	const instances = type.instances.slice(0, maxListedActorInstances);
	for (const instance of instances)
		rows.push({
			key: `instance-${id}-${instance.actorId}`,
			type: 'detail',
			kind: 'detail',
			title: instance.name || instance.actorId.slice(0, 12),
			subtitle: `${instance.actorId} · Started ${formatDiagnosticTime(instance.activatedAt)}`
		});
	if (type.instances.length > instances.length)
		rows.push({
			key: `instance-${id}-more`,
			type: 'message',
			kind: 'message',
			message: `${formatCount(type.instances.length - instances.length)} more active`
		});
	for (const failure of type.recentFailures)
		rows.push({
			key: `failure-${id}-${failure.jobId}`,
			type: 'detail',
			kind: 'detail',
			title: `${failure.name || failure.actorId.slice(0, 12)} · ${failure.method}`,
			subtitle: `${formatCount(failure.attempts)} attempts · ${formatDiagnosticTime(failure.failedAt)}`,
			detail: failure.lastError,
			color: systemColors.red
		});
	return rows;
}

function actorEntries(
	actors: ActorDiagnostics[] | undefined,
	error: string | undefined,
	expandedIDs: ReadonlySet<string>
): Entry[] {
	const entries = statusEntries('actors', error, !actors);
	if (!actors) return entries;
	if (actors.length === 0)
		return [
			...entries,
			...grouped([
				{
					key: 'actors-empty',
					type: 'message',
					kind: 'message' as const,
					message: 'No environments reported actor diagnostics'
				}
			])
		];
	for (const environment of actors) {
		entries.push(
			titleEntry(
				`env-${environment.environmentId}`,
				environment.environmentName || environment.environmentId
			)
		);
		const rows: Row[] = [];
		if (environment.error) {
			rows.push({
				key: `env-${environment.environmentId}-error`,
				type: 'error',
				kind: 'error',
				message: environment.error
			});
		} else if (!environment.ready) {
			rows.push({
				key: `env-${environment.environmentId}-starting`,
				type: 'message',
				kind: 'message',
				message: 'Starting',
				color: systemColors.orange
			});
		} else {
			rows.push({
				key: `env-${environment.environmentId}-runs`,
				type: 'value',
				kind: 'value',
				row: { label: 'Runs', value: actorRunsSummary(environment.runs) }
			});
			for (const host of environment.hosts)
				rows.push({
					key: `env-${environment.environmentId}-host-${host.hostId}`,
					type: 'detail',
					kind: 'detail',
					title: host.address,
					subtitle: `Last check ${formatDiagnosticTime(host.lastHealthCheck)}`
				});
			if (environment.actorTypes.length === 0)
				rows.push({
					key: `env-${environment.environmentId}-empty`,
					type: 'message',
					kind: 'message',
					message: 'No actor types'
				});
			for (const type of environment.actorTypes)
				rows.push(...actorTypeEntries(environment, type, expandedIDs));
		}
		entries.push(...grouped(rows));
	}
	return entries;
}

function ErrorRow({ message }: { message: string }) {
	return (
		<View
			accessibilityRole="alert"
			style={{ ...rowStyle, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 }}
		>
			<Icon name="exclamationmark.triangle" size={22} color={m3.error} />
			<Text style={[m3Type.bodyMedium, { flex: 1, color: m3.error }]}>{message}</Text>
		</View>
	);
}

function ValueRow({ row }: { row: DiagnosticRow }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 48,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{row.label}</Text>
			<Text
				style={[
					m3Type.bodyMedium,
					{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'], flexShrink: 1 }
				]}
				numberOfLines={2}
			>
				{row.value}
			</Text>
		</View>
	);
}

function HeapRow({ segments }: { segments: HeapSegments }) {
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
			<View
				style={{
					flexDirection: 'row',
					height: 8,
					borderRadius: 4,
					overflow: 'hidden',
					backgroundColor: colors.separator
				}}
			>
				<View style={{ flex: segments.inUse, backgroundColor: m3.primary }} />
				<View style={{ flex: segments.idle, backgroundColor: m3.primaryContainer }} />
				<View style={{ flex: segments.released, backgroundColor: colors.tertiaryLabel }} />
				<View
					style={{ flex: Math.max(0, 1 - segments.inUse - segments.idle - segments.released) }}
				/>
			</View>
		</View>
	);
}

function ConnectionRow({ connection }: { connection: WebSocketConnectionInfo }) {
	const details = [connection.resourceId, connection.clientIp, connection.userId]
		.filter((part): part is string => !!part)
		.join(' · ');
	return (
		<View style={rowStyle}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label, flex: 1 }]}>
					{connectionKindLabel(connection.kind)}
				</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{formatDiagnosticTime(connection.startedAt)}
				</Text>
			</View>
			{details ? (
				<Text
					style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: mono }]}
					numberOfLines={1}
					ellipsizeMode="middle"
				>
					{details}
				</Text>
			) : null}
		</View>
	);
}

function ActorTypeRow({
	entry,
	model
}: {
	entry: Extract<Entry, { kind: 'actorType' }>;
	model: DiagnosticsModel;
}) {
	const summary = actorTypeCounts(entry.actor)
		.map((row) => `${row.label} ${row.value}`)
		.join(' · ');
	return (
		<Pressable
			onPress={entry.expandable ? () => model.toggleExpanded(entry.id) : undefined}
			disabled={!entry.expandable}
			android_ripple={{ color: colors.separator as string }}
			accessibilityRole={entry.expandable ? 'button' : undefined}
			accessibilityState={entry.expandable ? { expanded: entry.expanded } : undefined}
			style={{ ...rowStyle, flexDirection: 'row', alignItems: 'center', gap: 12 }}
		>
			<View style={{ flex: 1, gap: 4 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label, fontFamily: mono }]}>
					{entry.actor.actorType}
				</Text>
				<Text
					style={[
						m3Type.bodySmall,
						{ color: entry.actor.deadJobs > 0 ? m3.error : colors.secondaryLabel }
					]}
				>
					{summary}
				</Text>
			</View>
			{entry.expandable ? (
				<Icon
					name={entry.expanded ? 'chevron.up' : 'chevron.down'}
					size={20}
					color={colors.secondaryLabel}
				/>
			) : null}
		</Pressable>
	);
}

function DetailRow({ entry }: { entry: Extract<Entry, { kind: 'detail' }> }) {
	return (
		<View style={[rowStyle, { paddingLeft: 32 }]}>
			<Text style={[m3Type.bodyMedium, { color: entry.color ?? colors.label }]}>{entry.title}</Text>
			<Text
				style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: mono }]}
				numberOfLines={1}
				ellipsizeMode="middle"
			>
				{entry.subtitle}
			</Text>
			{entry.detail ? (
				<Text selectable style={[m3Type.bodySmall, { color: m3.error, fontFamily: mono }]}>
					{entry.detail}
				</Text>
			) : null}
		</View>
	);
}

function GoroutineRow({
	entry,
	model
}: {
	entry: Extract<Entry, { kind: 'goroutine' }>;
	model: DiagnosticsModel;
}) {
	const { group } = entry.row;
	return (
		<Pressable
			onPress={() => model.toggleExpanded(entry.id)}
			android_ripple={{ color: colors.separator as string }}
			accessibilityRole="button"
			accessibilityState={{ expanded: entry.expanded }}
			style={rowStyle}
		>
			<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label, fontVariant: ['tabular-nums'] }]}>
					{formatCount(group.count)}
				</Text>
				<Text
					style={[m3Type.bodySmall, { color: colors.label, fontFamily: mono, flex: 1 }]}
					numberOfLines={entry.expanded ? undefined : 2}
				>
					{group.label}
				</Text>
				<Icon
					name={entry.expanded ? 'chevron.up' : 'chevron.down'}
					size={20}
					color={colors.secondaryLabel}
				/>
			</View>
			{entry.expanded ? (
				<Text
					selectable
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, fontFamily: mono, marginTop: 6 }
					]}
				>
					{group.frames
						.map((frame) => `${frame.function}\n  ${frame.file}:${frame.line}`)
						.join('\n')}
				</Text>
			) : null}
		</Pressable>
	);
}

function logColor(level: string): ColorValue {
	switch (logTone(level)) {
		case 'error':
			return m3.error;
		case 'warn':
			return systemColors.orange;
		case 'debug':
			return colors.secondaryLabel;
		case 'info':
			return systemColors.green;
	}
}

function LogRow({ row }: { row: DiagnosticLogRow }) {
	return (
		<View style={rowStyle}>
			<View style={{ flexDirection: 'row', gap: 8 }}>
				<Text
					style={[
						m3Type.labelSmall,
						{ color: logColor(row.entry.level), fontFamily: mono, fontWeight: '700' }
					]}
				>
					{row.entry.level.toUpperCase()}
				</Text>
				<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel, fontFamily: mono }]}>
					{logTimeLabel(row.entry.time)}
				</Text>
			</View>
			<Text selectable style={[m3Type.bodySmall, { color: colors.label, fontFamily: mono }]}>
				{row.entry.message}
			</Text>
			{row.attrs ? (
				<Text
					selectable
					style={[m3Type.labelSmall, { color: colors.secondaryLabel, fontFamily: mono }]}
				>
					{row.attrs}
				</Text>
			) : null}
		</View>
	);
}

function renderEntry(entry: Entry, model: DiagnosticsModel): ReactNode {
	switch (entry.kind) {
		case 'title':
			return <SectionTitle title={entry.title} />;
		case 'error':
			return <ErrorRow message={entry.message} />;
		case 'message':
			return (
				<View style={rowStyle}>
					<Text style={[m3Type.bodyMedium, { color: entry.color ?? colors.secondaryLabel }]}>
						{entry.message}
					</Text>
				</View>
			);
		case 'loading':
			return (
				<View style={{ paddingVertical: 32, alignItems: 'center' }}>
					<ActivityIndicator color={m3.primary as string} />
				</View>
			);
		case 'value':
			return <ValueRow row={entry.row} />;
		case 'heap':
			return <HeapRow segments={entry.segments} />;
		case 'connection':
			return <ConnectionRow connection={entry.connection} />;
		case 'actorType':
			return <ActorTypeRow entry={entry} model={model} />;
		case 'detail':
			return <DetailRow entry={entry} />;
		case 'goroutine':
			return <GoroutineRow entry={entry} model={model} />;
		case 'log':
			return <LogRow row={entry.row} />;
	}
}

function SearchField({
	placeholder,
	value,
	onChangeText
}: {
	placeholder: string;
	value: string;
	onChangeText: (value: string) => void;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				marginHorizontal: 16,
				marginTop: 12,
				paddingHorizontal: 16,
				minHeight: 56,
				borderRadius: 28,
				backgroundColor: colors.secondarySystemGroupedBackground
			}}
		>
			<Icon name="magnifyingglass" size={22} color={colors.secondaryLabel} />
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={colors.tertiaryLabel as string}
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="search"
				style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
			/>
			{value !== '' ? (
				<Pressable
					onPress={() => onChangeText('')}
					accessibilityRole="button"
					accessibilityLabel="Clear search"
					hitSlop={12}
				>
					<Icon name="xmark.circle.fill" size={20} color={colors.secondaryLabel} />
				</Pressable>
			) : null}
		</View>
	);
}

type SnapshotState = { snapshot: DiagnosticsSnapshot | undefined; error: string | undefined };

function DiagnosticsList({
	model,
	data,
	header
}: {
	model: DiagnosticsModel;
	data: Entry[];
	header?: ReactNode;
}) {
	const [refreshing, setRefreshing] = useState(false);
	return (
		<GroupedFlashList
			data={data}
			extraData={model.expanded}
			renderEntry={(entry) => renderEntry(entry, model)}
			header={header ? <>{header}</> : null}
			contentContainerStyle={contentStyle}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => {
						setRefreshing(true);
						void model.refresh().finally(() => setRefreshing(false));
					}}
					colors={[m3.primary as string]}
				/>
			}
		/>
	);
}

function OverviewTab({ model }: { model: DiagnosticsModel }) {
	const snapshot = useDiagnosticsValue(model.store, (s) => s.snapshot);
	const error = useDiagnosticsValue(model.store, (s) => s.snapshotError);
	return <DiagnosticsList model={model} data={overviewEntries({ snapshot, error })} />;
}

function ConnectionsTab({ model }: { model: DiagnosticsModel }) {
	const snapshot = useDiagnosticsValue(model.store, (s) => s.snapshot);
	const error = useDiagnosticsValue(model.store, (s) => s.snapshotError);
	return <DiagnosticsList model={model} data={connectionEntries({ snapshot, error })} />;
}

function ActorsTab({ model }: { model: DiagnosticsModel }) {
	const actors = useDiagnosticsValue(model.store, (s) => s.actors);
	const error = useDiagnosticsValue(model.store, (s) => s.actorsError);
	return <DiagnosticsList model={model} data={actorEntries(actors, error, model.expanded)} />;
}

function GoroutinesTab({ model }: { model: DiagnosticsModel }) {
	const profile = useDiagnosticsValue(model.store, (s) => s.goroutines);
	const error = useDiagnosticsValue(model.store, (s) => s.goroutinesError);
	const isLoading = useDiagnosticsValue(model.store, (s) => s.isLoadingGoroutines);
	const rows = filterGoroutineRows(goroutineRows(profile), model.goroutineSearch);
	const entries = statusEntries('goroutines', error, !profile && isLoading);
	if (profile) {
		entries.push(
			titleEntry(
				'goroutines-title',
				`${formatCount(profile.total)} goroutines in ${formatCount(profile.groups.length)} groups`
			)
		);
		entries.push(
			...(rows.length === 0
				? grouped([
						{
							key: 'goroutines-empty',
							type: 'message',
							kind: 'message' as const,
							message: 'No matches'
						}
					])
				: grouped(
						rows.map((row) => {
							const id = `g:${row.id}`;
							return {
								key: id,
								type: 'goroutine',
								kind: 'goroutine' as const,
								id,
								row,
								expanded: model.expanded.has(id)
							};
						})
					))
		);
	}
	return (
		<DiagnosticsList
			model={model}
			data={entries}
			header={
				<SearchField
					placeholder="Filter by function or file"
					value={model.goroutineSearch}
					onChangeText={model.setGoroutineSearch}
				/>
			}
		/>
	);
}

function LogsTab({ model }: { model: DiagnosticsModel }) {
	const logs = useDiagnosticsValue(model.store, (s) => s.logs);
	const error = useDiagnosticsValue(model.store, (s) => s.logsError);
	const rows = [...filterLogRows(logs, model.logLevel, model.logSearch)].reverse();
	const entries: Entry[] = [
		...statusEntries('logs', error, false),
		titleEntry('logs-title', `${formatCount(rows.length)} entries`),
		...(rows.length === 0
			? grouped([
					{
						key: 'logs-empty',
						type: 'message',
						kind: 'message' as const,
						message: 'Waiting for log entries'
					}
				])
			: grouped(
					rows.map((row) => ({ key: `log-${row.id}`, type: 'log', kind: 'log' as const, row }))
				))
	];
	return (
		<DiagnosticsList
			model={model}
			data={entries}
			header={
				<SearchField
					placeholder="Filter messages"
					value={model.logSearch}
					onChangeText={model.setLogSearch}
				/>
			}
		/>
	);
}

function DiagnosticsToolbar({ model }: { model: DiagnosticsModel }) {
	const items: AndroidToolbarItem[] = [];
	if (model.tab === 'overview' || model.tab === 'connections')
		items.push({
			kind: 'button',
			id: 'pause',
			icon: model.isPaused ? 'play.fill' : 'pause.fill',
			label: model.isPaused ? 'Resume' : 'Pause',
			onPress: model.togglePaused
		});
	if (model.tab === 'logs')
		items.push({
			kind: 'menu',
			id: 'log-options',
			icon: 'line.3.horizontal.decrease.circle',
			label: 'Log options',
			items: [
				...logLevelFilters.map((filter) => ({
					id: `level-${filter.value}`,
					title: filter.title,
					checked: model.logLevel === filter.value,
					onPress: () => model.setLogLevel(filter.value)
				})),
				{ id: 'clear', title: 'Clear', destructive: true, onPress: model.clearLogs }
			]
		});
	return <AndroidToolbar items={items} />;
}

function TabContent({ model }: { model: DiagnosticsModel }) {
	switch (model.tab) {
		case 'overview':
			return <OverviewTab key="overview" model={model} />;
		case 'connections':
			return <ConnectionsTab key="connections" model={model} />;
		case 'actors':
			return <ActorsTab key="actors" model={model} />;
		case 'goroutines':
			return <GoroutinesTab key="goroutines" model={model} />;
		case 'logs':
			return <LogsTab key="logs" model={model} />;
	}
}

export function DiagnosticsDestination() {
	const model = useDiagnostics();
	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: 'Diagnostics' }} />
			<DiagnosticsToolbar model={model} />
			<ScrollableTabBar
				selection={model.tab}
				onSelectionChange={model.setTab}
				options={diagnosticsTabs}
				accessibilityLabel="Diagnostics sections"
			/>
			<TabContent model={model} />
		</View>
	);
}
