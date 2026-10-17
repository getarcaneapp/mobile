/**
 * Port of `ImageVulnerabilitiesView` (ImageVulnerabilitiesView.swift): scan
 * summary, severity filter chips with the ignored toggle, re-scan, and the
 * paginated findings with admin ignore / unignore context menus.
 *
 * Embedded in the image detail screen it renders only its content (the host
 * screen owns the toolbar, including the Patch image link); standalone it
 * sets the "Vulnerabilities" title and its own toolbar.
 */
import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	HStack,
	Label,
	List,
	ProgressView,
	ScrollView,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	refreshable,
	scaleEffect,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import {
	DestructiveLabel,
	ResourceCountSectionHeader,
	SectionHeader
} from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

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

function SeverityFilterChips({ model }: { model: ImageVulnerabilitiesModel }) {
	return (
		<VStack alignment="leading" spacing={6}>
			<SectionHeader title="Filter" systemImage="line.3.horizontal.decrease.circle" />
			<ScrollView axes="horizontal" showsIndicators={false}>
				<HStack spacing={8} modifiers={[padding({ vertical: 2 })]}>
					{VulnerabilitySeverities.map((severity) => (
						<SeverityFilterChip
							key={severity}
							severity={severity}
							isActive={
								model.selectedSeverities.length === 0 || model.selectedSeverities.includes(severity)
							}
							onPress={() => model.toggleSeverity(severity)}
						/>
					))}
					<IgnoredChip showIgnored={model.showIgnored} onPress={model.toggleShowIgnored} />
				</HStack>
			</ScrollView>
			{model.selectedSeverities.length > 0 ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						padding({ horizontal: 4 })
					]}
				>
					Showing only selected severities.
				</Text>
			) : null}
		</VStack>
	);
}

function VulnerabilityLink({
	model,
	vulnerability
}: {
	model: ImageVulnerabilitiesModel;
	vulnerability: VulnerabilityRecord;
}) {
	const ignore = model.ignoreInfo(vulnerability);
	const link = (
		<Button onPress={() => model.openDetail(vulnerability)} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<VulnerabilityRow record={vulnerability} isIgnored={ignore !== undefined} />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
	if (!model.isAdmin) return link;
	return (
		<ContextMenu>
			<ContextMenu.Trigger>{link}</ContextMenu.Trigger>
			<ContextMenu.Items>
				{ignore ? (
					<Button
						label="Unignore"
						systemImage="eye"
						onPress={() => model.unignore(vulnerability)}
					/>
				) : (
					<Button
						role="destructive"
						onPress={() => model.requestIgnore(vulnerability)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Ignore" systemImage="eye.slash" />
					</Button>
				)}
			</ContextMenu.Items>
		</ContextMenu>
	);
}

function ScanList({ model }: { model: ImageVulnerabilitiesModel }) {
	const { summary, displayedVulnerabilities } = model;
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.reload)]}>
			{summary ? (
				<VStack alignment="leading" spacing={10}>
					<SectionHeader title="Summary" systemImage="chart.bar.doc.horizontal" />
					<VStack
						modifiers={[padding({ all: 12 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}
					>
						<SeveritySummaryRow
							summary={summary.summary}
							scanTime={summary.scanTime}
							status={summary.status}
							error={summary.error}
						/>
					</VStack>
				</VStack>
			) : null}

			<SeverityFilterChips model={model} />

			<Button onPress={() => void model.runScan()} modifiers={[disabled(model.isScanning)]}>
				<HStack modifiers={[padding({ all: 14 }), contentShape(shapes.rectangle())]}>
					<Label
						title={model.isScanning ? 'Scanning…' : 'Re-scan now'}
						systemImage="magnifyingglass"
						modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}
					/>
					<Spacer minLength={8} />
					{model.isScanning ? <ProgressView modifiers={[scaleEffect(0.8)]} /> : null}
				</HStack>
			</Button>

			{displayedVulnerabilities.length === 0 && !model.isLoading ? (
				<ContentUnavailableView
					title="No vulnerabilities"
					systemImage="checkmark.shield"
					description={
						summary === undefined
							? 'Run a scan to see results.'
							: 'Nothing matches the current filter.'
					}
					modifiers={[padding({ top: 24 })]}
				/>
			) : (
				<>
					<ResourceCountSectionHeader
						title="Findings"
						loadedCount={displayedVulnerabilities.length}
					/>
					{displayedVulnerabilities.map((vulnerability) => (
						<VulnerabilityLink key={vulnerability.id} model={model} vulnerability={vulnerability} />
					))}
					<PaginatedListFooter
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</>
			)}
		</List>
	);
}

function ScannerUnavailableView({ model }: { model: ImageVulnerabilitiesModel }) {
	return (
		<UnavailableView
			title="Scanner unavailable"
			systemImage="shield.slash"
			description="Trivy is not installed or reachable on the host. Install Trivy and reload to scan images."
			actions={[{ title: 'Reload', onPress: () => void model.initialLoad() }]}
		/>
	);
}

export function ImageVulnerabilitiesView(props: ImageVulnerabilitiesProps) {
	const model = useImageVulnerabilities(props);
	const embedded = props.embedded ?? false;
	return (
		<View style={{ flex: 1 }}>
			{!embedded ? (
				<Stack.Screen options={{ title: 'Vulnerabilities', headerLargeTitleEnabled: false }} />
			) : null}
			{!embedded && model.canPatch ? (
				<AppToolbar>
					<Stack.Toolbar.Button
						icon="wrench.and.screwdriver"
						accessibilityLabel="Patch image"
						onPress={model.openPatch}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				{model.status !== undefined && !model.status.available ? (
					<ScannerUnavailableView model={model} />
				) : (
					<ScanList model={model} />
				)}
			</Host>
		</View>
	);
}
