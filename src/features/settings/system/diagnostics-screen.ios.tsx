import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Label,
	LabeledContent,
	List,
	ProgressView,
	Section,
	Spacer,
	Text,
	TextField,
	VStack
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	lineLimit,
	listStyle,
	monospacedDigit,
	refreshable,
	shapes,
	submitLabel,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import type { ActorDiagnostics, ActorTypeInfo } from '@/sdk/models/diagnostics/Diagnostics';
import type { WebSocketConnectionInfo } from '@/sdk/models/system/WebSocketMetrics';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { FormPicker } from '@/ui/components/form-fields';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { Image } from '@/ui/components/swiftui-image';
import { AppToolbar } from '@/ui/app-toolbar';

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
	type GoroutineGroupRow
} from './diagnostics-model';
import { useDiagnostics, useDiagnosticsValue, type DiagnosticsModel } from './use-diagnostics';

const secondary = { type: 'hierarchical', style: 'secondary' } as const;

function ErrorSection({ message }: { message: string | undefined }) {
	if (!message) return null;
	return (
		<Section>
			<Label
				title={message}
				systemImage="exclamationmark.triangle"
				modifiers={[foregroundStyle(systemColors.red)]}
			/>
		</Section>
	);
}

function LoadingSection() {
	return (
		<Section>
			<HStack>
				<Spacer />
				<ProgressView />
				<Spacer />
			</HStack>
		</Section>
	);
}

function MessageSection({ text }: { text: string }) {
	return (
		<Section>
			<Text modifiers={[foregroundStyle(secondary)]}>{text}</Text>
		</Section>
	);
}

function ValueRows({ rows }: { rows: DiagnosticRow[] }) {
	return (
		<>
			{rows.map((row) => (
				<LabeledContent key={row.label} label={row.label}>
					<Text modifiers={[monospacedDigit()]}>{row.value}</Text>
				</LabeledContent>
			))}
		</>
	);
}

function OverviewList({ model }: { model: DiagnosticsModel }) {
	const snapshot = useDiagnosticsValue(model.store, (s) => s.snapshot);
	const error = useDiagnosticsValue(model.store, (s) => s.snapshotError);
	const segments = snapshot ? heapSegments(snapshot.memory) : undefined;
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			<ErrorSection message={error} />
			{!snapshot ? (
				error ? null : (
					<LoadingSection />
				)
			) : (
				<>
					{snapshot.runtime.leakedGoroutines > 0 ? (
						<Section>
							<Label
								title={`${formatCount(snapshot.runtime.leakedGoroutines)} leaked goroutines`}
								systemImage="exclamationmark.triangle.fill"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}
					<Section title="Runtime">
						<ValueRows rows={runtimeRows(snapshot)} />
					</Section>
					<Section title="Memory">
						{segments ? <ProgressView value={segments.inUse} /> : null}
						<ValueRows rows={heapLegend(snapshot.memory)} />
						<ValueRows rows={memoryRows(snapshot.memory)} />
					</Section>
					<Section title="Garbage Collector">
						<ValueRows rows={gcRows(snapshot)} />
					</Section>
				</>
			)}
		</List>
	);
}

function ConnectionRow({ connection }: { connection: WebSocketConnectionInfo }) {
	const details = [connection.resourceId, connection.clientIp, connection.userId]
		.filter((part): part is string => !!part)
		.join(' · ');
	return (
		<VStack alignment="leading" spacing={4}>
			<HStack>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
					{connectionKindLabel(connection.kind)}
				</Text>
				<Spacer minLength={8} />
				<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(secondary)]}>
					{formatDiagnosticTime(connection.startedAt)}
				</Text>
			</HStack>
			{details ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption', design: 'monospaced' }),
						foregroundStyle(secondary),
						lineLimit(1),
						truncationMode('middle')
					]}
				>
					{details}
				</Text>
			) : null}
		</VStack>
	);
}

function ConnectionsList({ model }: { model: DiagnosticsModel }) {
	const snapshot = useDiagnosticsValue(model.store, (s) => s.snapshot);
	const error = useDiagnosticsValue(model.store, (s) => s.snapshotError);
	const connections = snapshot?.websocket.connections ?? [];
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			<ErrorSection message={error} />
			{!snapshot ? (
				error ? null : (
					<LoadingSection />
				)
			) : (
				<>
					<Section title="Active Streams">
						<ValueRows rows={connectionCounts(snapshot)} />
					</Section>
					<Section title={`Connections (${formatCount(connections.length)})`}>
						{connections.length === 0 ? (
							<Text modifiers={[foregroundStyle(secondary)]}>No active connections</Text>
						) : (
							<List.ForEach
								data={connections}
								keyExtractor={(connection) => connection.id}
								estimatedItemSize={56}
							>
								{({ item }) => <ConnectionRow connection={item} />}
							</List.ForEach>
						)}
					</Section>
				</>
			)}
		</List>
	);
}

function ActorTypeRows({
	environment,
	type,
	model
}: {
	environment: ActorDiagnostics;
	type: ActorTypeInfo;
	model: DiagnosticsModel;
}) {
	const id = `${environment.environmentId}:${type.actorType}`;
	const expandable = type.instances.length > 0 || type.recentFailures.length > 0;
	const isExpanded = expandable && model.expanded.has(id);
	const summary = actorTypeCounts(type)
		.map((row) => `${row.label} ${row.value}`)
		.join(' · ');
	const instances = type.instances.slice(0, maxListedActorInstances);
	return (
		<>
			<Button
				onPress={expandable ? () => model.toggleExpanded(id) : undefined}
				modifiers={[buttonStyle('plain')]}
			>
				<HStack spacing={10} modifiers={[contentShape(shapes.rectangle())]}>
					<VStack alignment="leading" spacing={3}>
						<Text modifiers={[font({ textStyle: 'subheadline', design: 'monospaced' })]}>
							{type.actorType}
						</Text>
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle(type.deadJobs > 0 ? systemColors.red : secondary)
							]}
						>
							{summary}
						</Text>
					</VStack>
					<Spacer minLength={8} />
					{expandable ? (
						<Image
							systemName={isExpanded ? 'chevron.down' : 'chevron.right'}
							modifiers={[
								font({ textStyle: 'caption', weight: 'semibold' }),
								foregroundStyle(secondary)
							]}
						/>
					) : null}
				</HStack>
			</Button>
			{isExpanded
				? instances.map((instance) => (
						<VStack key={`i:${instance.actorId}`} alignment="leading" spacing={2}>
							<Text modifiers={[font({ textStyle: 'caption', weight: 'medium' })]}>
								{instance.name || instance.actorId.slice(0, 12)}
							</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption2', design: 'monospaced' }),
									foregroundStyle(secondary),
									lineLimit(1),
									truncationMode('middle')
								]}
							>
								{`${instance.actorId} · Started ${formatDiagnosticTime(instance.activatedAt)}`}
							</Text>
						</VStack>
					))
				: null}
			{isExpanded && type.instances.length > instances.length ? (
				<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(secondary)]}>
					{`${formatCount(type.instances.length - instances.length)} more active`}
				</Text>
			) : null}
			{isExpanded
				? type.recentFailures.map((failure) => (
						<VStack key={`f:${failure.jobId}`} alignment="leading" spacing={2}>
							<Text
								modifiers={[
									font({ textStyle: 'caption', weight: 'medium' }),
									foregroundStyle(systemColors.red)
								]}
							>
								{`${failure.name || failure.actorId.slice(0, 12)} · ${failure.method}`}
							</Text>
							<Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(secondary)]}>
								{`${formatCount(failure.attempts)} attempts · ${formatDiagnosticTime(failure.failedAt)}`}
							</Text>
							{failure.lastError ? (
								<Text
									modifiers={[
										font({ textStyle: 'caption2', design: 'monospaced' }),
										foregroundStyle(systemColors.red),
										textSelection(true)
									]}
								>
									{failure.lastError}
								</Text>
							) : null}
						</VStack>
					))
				: null}
		</>
	);
}

function ActorEnvironmentSection({
	environment,
	model
}: {
	environment: ActorDiagnostics;
	model: DiagnosticsModel;
}) {
	const title = environment.environmentName || environment.environmentId;
	const hosts = environment.hosts
		.map((host) => `${host.address} · ${formatDiagnosticTime(host.lastHealthCheck)}`)
		.join('\n');
	return (
		<Section title={title}>
			{environment.error ? (
				<Label
					title={environment.error}
					systemImage="exclamationmark.triangle"
					modifiers={[foregroundStyle(systemColors.red)]}
				/>
			) : !environment.ready ? (
				<Text modifiers={[foregroundStyle(systemColors.orange)]}>Starting</Text>
			) : (
				<>
					<LabeledContent label="Runs">
						<Text>{actorRunsSummary(environment.runs)}</Text>
					</LabeledContent>
					{hosts ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption', design: 'monospaced' }),
								foregroundStyle(secondary)
							]}
						>
							{hosts}
						</Text>
					) : null}
					{environment.actorTypes.length === 0 ? (
						<Text modifiers={[foregroundStyle(secondary)]}>No actor types</Text>
					) : (
						environment.actorTypes.map((type) => (
							<ActorTypeRows
								key={type.actorType}
								environment={environment}
								type={type}
								model={model}
							/>
						))
					)}
				</>
			)}
		</Section>
	);
}

function ActorsList({ model }: { model: DiagnosticsModel }) {
	const actors = useDiagnosticsValue(model.store, (s) => s.actors);
	const error = useDiagnosticsValue(model.store, (s) => s.actorsError);
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			<ErrorSection message={error} />
			{!actors ? (
				error ? null : (
					<LoadingSection />
				)
			) : actors.length === 0 ? (
				<MessageSection text="No environments reported actor diagnostics" />
			) : (
				actors.map((environment) => (
					<ActorEnvironmentSection
						key={environment.environmentId}
						environment={environment}
						model={model}
					/>
				))
			)}
		</List>
	);
}

function SearchSection({
	placeholder,
	onChange,
	children
}: {
	placeholder: string;
	onChange: (value: string) => void;
	children?: React.ReactNode;
}) {
	return (
		<Section>
			<HStack spacing={8}>
				<Image systemName="magnifyingglass" modifiers={[foregroundStyle(secondary)]} />
				<TextField
					placeholder={placeholder}
					onTextChange={onChange}
					modifiers={[autocorrectionDisabled(true), submitLabel('search')]}
				/>
			</HStack>
			{children}
		</Section>
	);
}

function GoroutineRow({ row, model }: { row: GoroutineGroupRow; model: DiagnosticsModel }) {
	const isExpanded = model.expanded.has(`g:${row.id}`);
	return (
		<Button onPress={() => model.toggleExpanded(`g:${row.id}`)} modifiers={[buttonStyle('plain')]}>
			<VStack alignment="leading" spacing={6} modifiers={[contentShape(shapes.rectangle())]}>
				<HStack alignment="firstTextBaseline" spacing={10}>
					<Text
						modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), monospacedDigit()]}
					>
						{formatCount(row.group.count)}
					</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption', design: 'monospaced' }),
							...(isExpanded ? [] : [lineLimit(2)])
						]}
					>
						{row.group.label}
					</Text>
					<Spacer minLength={4} />
					<Image
						systemName={isExpanded ? 'chevron.down' : 'chevron.right'}
						modifiers={[
							font({ textStyle: 'caption', weight: 'semibold' }),
							foregroundStyle(secondary)
						]}
					/>
				</HStack>
				{isExpanded ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2', design: 'monospaced' }),
							foregroundStyle(secondary),
							textSelection(true)
						]}
					>
						{row.group.frames
							.map((frame) => `${frame.function}\n  ${frame.file}:${frame.line}`)
							.join('\n')}
					</Text>
				) : null}
			</VStack>
		</Button>
	);
}

function GoroutinesList({ model }: { model: DiagnosticsModel }) {
	const profile = useDiagnosticsValue(model.store, (s) => s.goroutines);
	const error = useDiagnosticsValue(model.store, (s) => s.goroutinesError);
	const isLoading = useDiagnosticsValue(model.store, (s) => s.isLoadingGoroutines);
	const rows = filterGoroutineRows(goroutineRows(profile), model.goroutineSearch);
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			<SearchSection placeholder="Filter by function or file" onChange={model.setGoroutineSearch} />
			<ErrorSection message={error} />
			{!profile ? (
				isLoading ? (
					<LoadingSection />
				) : null
			) : (
				<Section
					title={`${formatCount(profile.total)} goroutines in ${formatCount(profile.groups.length)} groups`}
				>
					{rows.length === 0 ? (
						<Text modifiers={[foregroundStyle(secondary)]}>No matches</Text>
					) : (
						<List.ForEach data={rows} keyExtractor={(row) => row.id} estimatedItemSize={64}>
							{({ item }) => <GoroutineRow row={item} model={model} />}
						</List.ForEach>
					)}
				</Section>
			)}
		</List>
	);
}

function logColor(level: string) {
	switch (logTone(level)) {
		case 'error':
			return systemColors.red;
		case 'warn':
			return systemColors.orange;
		case 'debug':
			return systemColors.gray;
		case 'info':
			return systemColors.green;
	}
}

function LogRow({ row }: { row: DiagnosticLogRow }) {
	return (
		<VStack alignment="leading" spacing={3}>
			<HStack spacing={8}>
				<Text
					modifiers={[
						font({ textStyle: 'caption2', design: 'monospaced', weight: 'semibold' }),
						foregroundStyle(logColor(row.entry.level))
					]}
				>
					{row.entry.level.toUpperCase()}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2', design: 'monospaced' }),
						foregroundStyle(secondary)
					]}
				>
					{logTimeLabel(row.entry.time)}
				</Text>
			</HStack>
			<Text modifiers={[font({ textStyle: 'caption', design: 'monospaced' }), textSelection(true)]}>
				{row.entry.message}
			</Text>
			{row.attrs ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption2', design: 'monospaced' }),
						foregroundStyle(secondary),
						textSelection(true)
					]}
				>
					{row.attrs}
				</Text>
			) : null}
		</VStack>
	);
}

function LogsList({ model }: { model: DiagnosticsModel }) {
	const logs = useDiagnosticsValue(model.store, (s) => s.logs);
	const error = useDiagnosticsValue(model.store, (s) => s.logsError);
	const rows = [...filterLogRows(logs, model.logLevel, model.logSearch)].reverse();
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			<SearchSection placeholder="Filter messages" onChange={model.setLogSearch}>
				<FormPicker
					title="Level"
					selection={model.logLevel}
					onSelectionChange={model.setLogLevel}
					options={logLevelFilters.map((filter) => ({ label: filter.title, value: filter.value }))}
				/>
				<Button label="Clear" systemImage="trash" onPress={model.clearLogs} />
			</SearchSection>
			<ErrorSection message={error} />
			<Section title={`${formatCount(rows.length)} entries`}>
				{rows.length === 0 ? (
					<Text modifiers={[foregroundStyle(secondary)]}>Waiting for log entries</Text>
				) : (
					<List.ForEach data={rows} keyExtractor={(row) => String(row.id)} estimatedItemSize={60}>
						{({ item }) => <LogRow row={item} />}
					</List.ForEach>
				)}
			</Section>
		</List>
	);
}

function TabContent({ model }: { model: DiagnosticsModel }) {
	switch (model.tab) {
		case 'overview':
			return <OverviewList key="overview" model={model} />;
		case 'connections':
			return <ConnectionsList key="connections" model={model} />;
		case 'actors':
			return <ActorsList key="actors" model={model} />;
		case 'goroutines':
			return <GoroutinesList key="goroutines" model={model} />;
		case 'logs':
			return <LogsList key="logs" model={model} />;
	}
}

export function DiagnosticsDestination() {
	const model = useDiagnostics();
	const accent = useAccentColor();
	const showsPause = model.tab === 'overview' || model.tab === 'connections';
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'Diagnostics', headerLargeTitleEnabled: false }} />
			{showsPause ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Button
						icon={model.isPaused ? 'play.fill' : 'pause.fill'}
						accessibilityLabel={model.isPaused ? 'Resume' : 'Pause'}
						onPress={model.togglePaused}
					/>
				</AppToolbar>
			) : null}
			<ScrollableTabBar
				selection={model.tab}
				onSelectionChange={model.setTab}
				options={diagnosticsTabs}
				accessibilityLabel="Diagnostics sections"
			/>
			<Host style={{ flex: 1 }}>
				<TabContent model={model} />
			</Host>
		</View>
	);
}
