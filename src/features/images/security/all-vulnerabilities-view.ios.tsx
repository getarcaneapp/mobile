import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	Label,
	List,
	ProgressView,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	listRowBackground,
	listStyle,
	padding,
	refreshable,
	scaleEffect,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { environmentDisplayName } from '@/stores/environments-store';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { EnvironmentLoadFailuresSection } from '@/ui/components/environment-label';
import {
	environmentActionIsMenu,
	environmentTitle,
	type ListEnvironment
} from '@/ui/components/environment-label.types';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { SeverityBar } from '@/ui/components/severity-bar';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

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
		<VStack alignment="leading" spacing={2}>
			<Text modifiers={[font({ textStyle: 'title3', weight: 'bold' }), foregroundStyle(color)]}>
				{value}
			</Text>
			<Text
				modifiers={[
					font({ textStyle: 'caption2' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{label}
			</Text>
		</VStack>
	);
}

function SummaryCard({ model }: { model: AllVulnerabilitiesModel }) {
	const accent = useAccentColor();
	const summary = model.summary;
	if (!summary) {
		return (
			<HStack>
				<ProgressView modifiers={[scaleEffect(0.8)]} />
				<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
					Loading…
				</Text>
			</HStack>
		);
	}
	const s = summary.summary;
	return (
		<VStack alignment="leading" spacing={8} modifiers={[padding({ vertical: 4 })]}>
			<HStack>
				<Metric label="Images" value={String(summary.totalImages)} color="secondary" />
				<Spacer />
				<Metric label="Scanned" value={String(summary.scannedImages)} color={accent} />
				{s ? (
					<>
						<Spacer />
						<Metric
							label="Total CVEs"
							value={String(s.total)}
							color={s.total > 0 ? systemColors.orange : 'secondary'}
						/>
					</>
				) : null}
			</HStack>
			{s ? (
				<SeverityBar
					critical={s.critical}
					high={s.high}
					medium={s.medium}
					low={s.low}
					unknown={s.unknown}
				/>
			) : null}
		</VStack>
	);
}

function FindingLink({ model, item }: { model: AllVulnerabilitiesModel; item: FindingItem }) {
	const environmentColor = useEnvironmentRowColor(item.environmentID, item.environmentName);
	return (
		<Button onPress={() => model.openFinding(item)} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<VulnerabilityWithImageRow
					item={item.value}
					environmentName={item.environmentName}
					environmentColor={environmentColor}
				/>
				<DisclosureChevron />
			</HStack>
		</Button>
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
		<Section title="Environment summary">
			<SummaryCard model={model} />
			{model.overviewError ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{model.overviewError}
				</Text>
			) : null}
		</Section>
	);
}

function FindingsContent({ model }: { model: AllVulnerabilitiesModel }) {
	const { snapshot, displayedItems } = model;
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
				<Section>
					<HStack>
						<Text>{`Showing ${model.focusedVulnerabilityID}`}</Text>
						<Spacer />
						<Button label="Clear" onPress={model.clearFocus} />
					</HStack>
				</Section>
			) : null}
			{model.exportURI !== undefined ? (
				<Section>
					<Button onPress={model.shareExport}>
						<Label title="Share exported CSV" systemImage="square.and.arrow.up" />
					</Button>
				</Section>
			) : null}
			{displayedItems.length > 0 ? (
				<Section title="Findings">
					{displayedItems.map((item) => (
						<FindingLink key={item.id} model={model} item={item} />
					))}
					<PaginatedListFooter
						hasMore={snapshot.hasMore}
						loadMoreError={snapshot.loadMoreError}
						onRetry={model.loadMore}
						onLoadMore={model.loadMore}
					/>
				</Section>
			) : !snapshot.isLoading ? (
				<ContentUnavailableView
					title="No vulnerabilities"
					systemImage="checkmark.shield"
					description="Either no images have been scanned, or all findings have been filtered out."
					modifiers={[listRowBackground('clear')]}
				/>
			) : null}
		</>
	);
}

function EnvironmentToolbarItem({
	title,
	systemImage,
	environments,
	disabled,
	action
}: {
	title: string;
	systemImage: string;
	environments: ListEnvironment[];
	disabled?: boolean;
	action: (environmentID: string) => void;
}) {
	const first = environments[0];
	if (environmentActionIsMenu(environments)) {
		return (
			<Stack.Toolbar.Menu
				icon={systemImage as SFSymbol}
				accessibilityLabel={title}
				disabled={disabled}
			>
				{environments.map((environment) => (
					<Stack.Toolbar.MenuAction key={environment.id} onPress={() => action(environment.id)}>
						{environmentTitle(environment)}
					</Stack.Toolbar.MenuAction>
				))}
			</Stack.Toolbar.Menu>
		);
	}
	if (!first) return null;
	return (
		<Stack.Toolbar.Button
			icon={systemImage as SFSymbol}
			accessibilityLabel={title}
			disabled={disabled}
			onPress={() => action(first.id)}
		/>
	);
}

function SecurityToolbar({ model }: { model: AllVulnerabilitiesModel }) {
	const { toolbar } = model;
	return (
		<AppToolbar>
			{toolbar.showsPatchEnvironmentAction ? (
				<EnvironmentToolbarItem
					title="Patch images"
					systemImage="wrench.and.screwdriver"
					environments={model.patchEnvironments}
					action={model.openPatchTargets}
				/>
			) : null}
			{toolbar.showsPatchLink ? (
				<Stack.Toolbar.Button
					icon="wrench.and.screwdriver"
					accessibilityLabel="Patch images"
					onPress={() => model.openPatchTargets(model.environmentID)}
				/>
			) : null}
			{toolbar.showsOverviewEnvironmentPicker ? (
				<Stack.Toolbar.Menu icon="server.rack" accessibilityLabel="Environment">
					{model.enabledEnvironments.map((environment) => (
						<Stack.Toolbar.MenuAction
							key={environment.id}
							isOn={environment.id === model.overviewEnvironmentID}
							onPress={() => model.selectOverviewEnvironment(environment.id)}
						>
							{environmentDisplayName(environment)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : null}
			{toolbar.showsFindingsActions ? (
				<Stack.Toolbar.Button
					icon={
						model.filterCount > 0
							? 'line.3.horizontal.decrease.circle.fill'
							: 'line.3.horizontal.decrease.circle'
					}
					accessibilityLabel="Filter vulnerabilities"
					onPress={model.openFilter}
				/>
			) : null}
			{toolbar.showsFindingsActions && model.allEnvironments ? (
				<EnvironmentToolbarItem
					title="Export CSV"
					systemImage="square.and.arrow.up"
					environments={model.exportEnvironments}
					disabled={toolbar.exportDisabled}
					action={model.exportCSV}
				/>
			) : null}
			{toolbar.showsFindingsActions && !model.allEnvironments ? (
				<Stack.Toolbar.Button
					icon="square.and.arrow.up"
					accessibilityLabel="Export vulnerabilities as CSV"
					disabled={toolbar.exportDisabled}
					onPress={() => model.exportCSV(model.environmentID)}
				/>
			) : null}
		</AppToolbar>
	);
}

export function AllVulnerabilitiesView(props: AllVulnerabilitiesProps) {
	const model = useAllVulnerabilities(props);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Security',
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false,
					headerStyle: { backgroundColor: colors.systemGroupedBackground }
				}}
			/>
			<SecurityToolbar model={model} />
			<View style={{ flex: 1 }}>
				<ScrollableTabBar
					selection={model.selectedSection}
					onSelectionChange={model.setSelectedSection}
					options={model.sectionOptions}
					accessibilityLabel="Security sections"
				/>
				<Host style={{ flex: 1 }}>
					<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
						{model.selectedSection === 'overview' ? (
							<OverviewContent model={model} />
						) : (
							<FindingsContent model={model} />
						)}
					</List>
				</Host>
			</View>
		</>
	);
}
