/**
 * Port of `ImageDetailView` (ImageDetailView.swift): a scrollable section bar
 * (Overview / History / Attestations / Vulnerabilities) above the selected
 * tab, with Recheck + actions in the toolbar.
 */
import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	LabeledContent,
	List,
	ProgressView,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	padding,
	refreshable,
	scaleEffect,
	textSelection,
	truncationMode,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { canPatchImage, useSecurityNavigation } from '@/features/images/security/security-routes';
import { ImageVulnerabilitiesView } from '@/features/images/security/image-vulnerabilities-view';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { UpdateStateBadge } from '@/ui/components/labels';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { containerDisplayName, containerIsRunning } from '@/features/containers/container-model';

import { byteString, imageConfigRows, shortPredicateName } from './image-model';
import { useImageNavigation } from './image-routes';
import { ImageAttestationsView, ImageHistoryView } from './image-tabs';
import {
	headerDate,
	imageDetailSections,
	useImageDetail,
	type ImageDetailModel
} from './use-image-detail';
import { useImageAttestations, type ImageAttestationsModel } from './use-image-tabs';

function ImageHeader({ model }: { model: ImageDetailModel }) {
	const { details } = model;
	return (
		<HStack spacing={14} modifiers={[padding({ vertical: 4 })]}>
			<Image
				systemName="square.3.layers.3d.top.filled"
				modifiers={[
					font({ textStyle: 'title2' }),
					foregroundStyle(systemColors.purple),
					frame({ width: 48, height: 48 })
				]}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{model.displayName}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2', design: 'monospaced' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						textSelection(true),
						lineLimit(1),
						truncationMode('middle')
					]}
				>
					{model.image.id}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{byteString(model.image.size)}
				</Text>
				{details ? (
					<>
						<Text
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>{`${details.os}/${details.architecture}`}</Text>
						<Text
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{headerDate(details.created)}
						</Text>
					</>
				) : null}
				{model.isCheckingUpdate ? (
					<HStack spacing={5}>
						<ProgressView modifiers={[scaleEffect(0.6)]} />
						<Text
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							Checking…
						</Text>
					</HStack>
				) : model.updateState.kind !== 'unknown' ? (
					<UpdateStateBadge state={model.updateState} />
				) : null}
				{model.versionChange ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{model.versionChange}
					</Text>
				) : null}
			</VStack>
		</HStack>
	);
}

function MonospacedRow({ label, value }: { label: string; value: string }) {
	return (
		<LabeledContent label={label}>
			<Text
				modifiers={[
					font({ textStyle: 'body', design: 'monospaced' }),
					textSelection(true),
					fixedSize({ horizontal: false, vertical: true })
				]}
			>
				{value}
			</Text>
		</LabeledContent>
	);
}

function OverviewTab({ model }: { model: ImageDetailModel }) {
	const { details, usingContainers } = model;
	const configRows = details ? imageConfigRows(details.config) : [];
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
			<Section>
				<ImageHeader model={model} />
			</Section>
			{details ? (
				<>
					<Section title="Overview">
						{model.metadataItems(details).map((item) => (
							<LabeledContent key={item.label} label={item.label}>
								<Text modifiers={[textSelection(true)]}>{item.value}</Text>
							</LabeledContent>
						))}
					</Section>
					<Section title="Identity">
						<MonospacedRow label="Image ID" value={details.id} />
						{details.repoTags.length > 0 ? (
							<MonospacedRow label="Tags" value={details.repoTags.join('\n')} />
						) : null}
					</Section>
				</>
			) : model.isLoading ? (
				<ArcaneLoadingViewSwiftUI fillsWidth />
			) : null}
			{usingContainers.length > 0 ? (
				<Section title={`Used By (${usingContainers.length})`}>
					{usingContainers.map((container) => (
						<Button
							key={container.id}
							onPress={() => model.openContainer(container)}
							modifiers={[buttonStyle('plain')]}
						>
							<HStack spacing={10} modifiers={[contentShape(shapes.rectangle())]}>
								<StatusIcon status={container.status} isLive={containerIsRunning(container)} />
								<Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('primary')]}>
									{containerDisplayName(container)}
								</Text>
								<Spacer minLength={8} />
								<DisclosureChevron />
							</HStack>
						</Button>
					))}
				</Section>
			) : null}
			{details ? (
				<>
					{details.repoTags.length > 1 ? (
						<Section title="Tags">
							{details.repoTags.map((tag) => (
								<Text
									key={tag}
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										textSelection(true),
										truncationMode('middle'),
										frame({ maxWidth: Infinity, alignment: 'leading' })
									]}
								>
									{tag}
								</Text>
							))}
						</Section>
					) : null}
					{configRows.length > 0 ? (
						<Section title="Image Config">
							{configRows.map((row) =>
								row.kind === 'link' ? (
									<Button
										key={row.title}
										onPress={() => model.openConfigPage(row.page)}
										modifiers={[buttonStyle('plain')]}
									>
										<HStack modifiers={[contentShape(shapes.rectangle())]}>
											<Text>{row.title}</Text>
											<Spacer />
											<DisclosureChevron />
										</HStack>
									</Button>
								) : row.kind === 'value' ? (
									<MonospacedRow key={row.label} label={row.label} value={row.value} />
								) : (
									<LabeledContent key={row.label} label={row.label}>
										<Text modifiers={[textSelection(true)]}>{row.value}</Text>
									</LabeledContent>
								)
							)}
						</Section>
					) : null}
				</>
			) : null}
		</List>
	);
}

/**
 * The detail toolbar: `.resourceActionsToolbar` plus the archive ShareLink and
 * the selected tab's own items (attestation type filter, patch link). One
 * `Stack.Toolbar` per placement, since each replaces the header's items.
 */
function ImageDetailToolbar({
	model,
	attestations
}: {
	model: ImageDetailModel;
	attestations: ImageAttestationsModel;
}) {
	const accent = useAccentColor();
	const security = useSecurityNavigation();
	const [pending, setPending] = useState<ActionButtonItem>();
	useItemDeleteConfirmation(pending, setPending, (item) => ({
		title: `${item.title}?`,
		message: item.confirmationMessage ?? `Are you sure you want to ${item.title.toLowerCase()}?`,
		icon: item.systemImage,
		actions: [{ title: item.title, action: item.action }]
	}));
	const { primary, overflow, runningItemID, isDisabled } = model.toolbar;
	const handle = (item: ActionButtonItem) =>
		item.role === 'destructive' ? setPending(item) : item.action();
	const disabled = (item: ActionButtonItem) =>
		isDisabled || (runningItemID !== undefined && runningItemID !== item.id);
	const section = model.selectedSection;
	const showsPredicateFilter = section === 'attestations' && attestations.predicateTypes.length > 1;
	const showsPatch = section === 'vulnerabilities' && canPatchImage(model.environmentID);
	return (
		<AppToolbar placement="right" tintColor={accent}>
			{model.exportedImage ? (
				<Stack.Toolbar.Button
					icon="square.and.arrow.up"
					accessibilityLabel="Share image archive"
					onPress={model.shareExport}
				/>
			) : null}
			{runningItemID === primary.id ? (
				<Stack.Toolbar.View>
					<ActivityIndicator accessibilityLabel={primary.title} />
				</Stack.Toolbar.View>
			) : (
				<Stack.Toolbar.Button
					icon={primary.systemImage as SFSymbol}
					tintColor={primary.tint}
					accessibilityLabel={primary.title}
					disabled={disabled(primary)}
					onPress={() => handle(primary)}
				/>
			)}
			<Stack.Toolbar.Menu
				icon="ellipsis.circle"
				accessibilityLabel="More actions"
				disabled={isDisabled}
			>
				{overflow.map((item) => (
					<Stack.Toolbar.MenuAction
						key={item.id}
						icon={item.systemImage as SFSymbol}
						destructive={item.role === 'destructive' || item.tint === systemColors.red}
						disabled={disabled(item)}
						onPress={() => handle(item)}
					>
						{item.title}
					</Stack.Toolbar.MenuAction>
				))}
			</Stack.Toolbar.Menu>
			{/* The embedded tab view's own toolbar items (Swift: inner `.toolbar`) follow the detail's actions. */}
			{showsPredicateFilter ? (
				<Stack.Toolbar.Menu
					icon={
						attestations.selectedPredicateType === undefined
							? 'line.3.horizontal.decrease.circle'
							: 'line.3.horizontal.decrease.circle.fill'
					}
					accessibilityLabel="Filter by predicate type"
				>
					<Stack.Toolbar.MenuAction
						isOn={attestations.selectedPredicateType === undefined}
						onPress={() => attestations.setSelectedPredicateType(undefined)}
					>
						All Types
					</Stack.Toolbar.MenuAction>
					{attestations.predicateTypes.map((type) => (
						<Stack.Toolbar.MenuAction
							key={type}
							isOn={attestations.selectedPredicateType === type}
							onPress={() => attestations.setSelectedPredicateType(type)}
						>
							{shortPredicateName(type)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : null}
			{showsPatch ? (
				<Stack.Toolbar.Button
					icon="wrench.and.screwdriver"
					accessibilityLabel="Patch image"
					onPress={() =>
						security.openImagePatch(model.environmentID, model.image.id, model.displayName)
					}
				/>
			) : null}
		</AppToolbar>
	);
}

export function ImageDetailScreen() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const model = useImageDetail(envID, id);
	const nav = useImageNavigation();
	const attestations = useImageAttestations(envID, id, model.selectedSection === 'attestations');

	return (
		<>
			<Stack.Screen
				options={{
					// The embedded Attestations / Vulnerabilities views set `.navigationTitle("")`, which wins over the detail's title.
					title:
						model.selectedSection === 'attestations' || model.selectedSection === 'vulnerabilities'
							? ''
							: 'Image Details',
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false,
					headerStyle: { backgroundColor: colors.systemGroupedBackground }
				}}
			/>
			<ImageDetailToolbar model={model} attestations={attestations} />
			<View style={{ flex: 1 }}>
				<ScrollableTabBar
					selection={model.selectedSection}
					onSelectionChange={model.setSelectedSection}
					options={imageDetailSections}
					accessibilityLabel="Image detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedSection === 'overview' ? (
						<Host style={{ flex: 1 }}>
							<OverviewTab model={model} />
						</Host>
					) : null}
					{model.selectedSection === 'history' ? (
						<ImageHistoryView environmentID={envID} imageID={model.image.id} />
					) : null}
					{model.selectedSection === 'attestations' ? (
						<ImageAttestationsView
							model={attestations}
							onOpen={(attestation) => nav.openAttestation(envID, model.image.id, attestation)}
						/>
					) : null}
					{model.selectedSection === 'vulnerabilities' ? (
						<ImageVulnerabilitiesView
							imageID={model.image.id}
							imageDisplayName={model.displayName}
							environmentID={envID}
							embedded
						/>
					) : null}
				</View>
			</View>
		</>
	);
}
