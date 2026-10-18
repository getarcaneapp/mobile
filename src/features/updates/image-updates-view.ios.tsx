import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	BottomSheet,
	Button,
	ContentUnavailableView,
	ContextMenu,
	Divider,
	Form,
	Group,
	HStack,
	Label,
	LazyVStack,
	List,
	Menu,
	NavigationStack,
	Picker,
	ProgressView,
	ScrollView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	background,
	buttonBorderShape,
	buttonStyle,
	contentShape,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	labelsHidden,
	lineLimit,
	listStyle,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	pickerStyle,
	presentationDetents,
	presentationDragIndicator,
	refreshable,
	shapes,
	tag,
	textSelection,
	tint,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useState, type ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { ListSortOrder } from '@/core/list-sort-order';
import type { ImageUsedBy } from '@/sdk/models/image/ImageSummary';
import type { ImageUpdateResponse } from '@/sdk/models/imageUpdate/ImageUpdate';
import { environmentDisplayName } from '@/stores/environments-store';
import { useAccentColor } from '@/theme/accent';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { EnvironmentFilterSection, EnvironmentLabel } from '@/ui/components/environment-label';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { RowIcon } from '@/ui/components/row-icon';
import { DashboardCardBackground } from '@/ui/components/swiftui-surfaces';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { useToolbarIcons } from '@/ui/toolbar-icon';

import { OutdatedImage, rowKey, updateTypeBadge, type EnvUpdateBucket } from './updates-logic';
import { UpdaterRunSheet } from './updater-run';
import {
	useImageUpdates,
	type ImageDetailTarget,
	type ImageUpdatesModel
} from './use-image-updates';

function UpdateTypeBadge({ info }: { info: ImageUpdateResponse }) {
	const badge = updateTypeBadge(info);
	if (!badge) return null;
	return (
		<Text
			modifiers={[
				font({ textStyle: 'caption2', weight: 'bold' }),
				foregroundStyle(badge.tint),
				padding({ horizontal: 6, vertical: 2 }),
				background(withOpacity(badge.tint, 0.13), shapes.capsule())
			]}
		>
			{badge.text}
		</Text>
	);
}

function RecheckButton({
	model,
	refName,
	bucket
}: {
	model: ImageUpdatesModel;
	refName: string;
	bucket: EnvUpdateBucket;
}) {
	if (model.checkingKeys.has(rowKey(bucket.id, refName)))
		return <ProgressView modifiers={[controlSize('small')]} />;
	return (
		<Button
			onPress={() => void model.recheck(bucket, refName)}
			modifiers={[buttonStyle('borderless'), disabled(model.rescanningEnvID !== undefined)]}
		>
			<Image
				systemName="arrow.clockwise"
				modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}
			/>
		</Button>
	);
}

function OutdatedImageRow({
	model,
	item,
	bucket
}: {
	model: ImageUpdatesModel;
	item: OutdatedImage;
	bucket: EnvUpdateBucket;
}) {
	const isUpdating = model.updatingKeys.has(rowKey(bucket.id, item.image.id));
	const actionable = model.actionableConsumers(item);
	const name = OutdatedImage.repoDisplayName(item);
	const allEnvironments = model.allEnvironmentsPreview;
	const environmentColor = useEnvironmentRowColor(bucket.id, environmentDisplayName(bucket.env));
	const busy = model.anyWorkInFlight(bucket);

	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<HStack spacing={12} modifiers={[padding({ vertical: allEnvironments ? 0 : 10 })]}>
					<Button
						onPress={() => model.setDetailTarget({ envID: bucket.id, imageID: item.image.id })}
						modifiers={[buttonStyle('plain')]}
					>
						<HStack spacing={12} modifiers={[contentShape(shapes.rectangle())]}>
							<RowIcon systemImage="square.3.layers.3d.top.filled" tint={systemColors.orange} />
							<VStack alignment="leading" spacing={3}>
								<HStack spacing={6}>
									<Text
										modifiers={[
											font(
												allEnvironments
													? { textStyle: 'body' }
													: { textStyle: 'subheadline', weight: 'semibold' }
											),
											foregroundStyle('primary'),
											lineLimit(1),
											truncationMode('middle')
										]}
									>
										{name}
									</Text>
									<UpdateTypeBadge info={item.info} />
								</HStack>
								<Text
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
										lineLimit(1),
										truncationMode('middle')
									]}
								>
									{OutdatedImage.versionChange(item)}
								</Text>
								{allEnvironments ? (
									<EnvironmentLabel
										name={environmentDisplayName(bucket.env)}
										color={environmentColor}
									/>
								) : null}
							</VStack>
							<Spacer minLength={0} />
						</HStack>
					</Button>
					{isUpdating ? (
						<ProgressView modifiers={[controlSize('small'), frame({ width: 30 })]} />
					) : actionable.length > 0 ? (
						<Button
							onPress={() => void model.startImageUpdate(item, bucket)}
							modifiers={[
								buttonStyle('borderless'),
								tint(systemColors.orange),
								disabled(busy),
								accessibilityLabel(`Update ${name}`)
							]}
						>
							<Image
								systemName="arrow.up.circle.fill"
								modifiers={[
									font({ textStyle: 'title3', weight: 'semibold' }),
									frame({ width: 30, height: 30 })
								]}
							/>
						</Button>
					) : (
						<RecheckButton model={model} refName={item.ref} bucket={bucket} />
					)}
				</HStack>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{actionable.length > 0 ? (
					<Button
						label="Update Image"
						systemImage="arrow.up.circle.fill"
						onPress={() => void model.startImageUpdate(item, bucket)}
						modifiers={[disabled(busy)]}
					/>
				) : null}
				<Button
					label="Recheck Registry"
					systemImage="arrow.clockwise"
					onPress={() => void model.recheck(bucket, item.ref)}
					modifiers={[disabled(model.rescanningEnvID !== undefined)]}
				/>
				<Button
					label="Copy Image Ref"
					systemImage="doc.on.doc"
					onPress={() => model.copyRef(item)}
				/>
			</ContextMenu.Items>
		</ContextMenu>
	);
}

function EnvironmentMenu({
	model,
	bucket,
	hasUpdates
}: {
	model: ImageUpdatesModel;
	bucket: EnvUpdateBucket;
	hasUpdates: boolean;
}) {
	if (model.rescanningEnvID === bucket.id) {
		return <ProgressView modifiers={[controlSize('small'), frame({ width: 26, height: 26 })]} />;
	}
	return (
		<Menu
			label={
				<Image
					systemName="ellipsis.circle"
					modifiers={[
						font({ textStyle: 'body', weight: 'medium' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						frame({ width: 26, height: 26 }),
						contentShape(shapes.rectangle())
					]}
				/>
			}
		>
			{hasUpdates ? (
				<Button
					label="Update All"
					systemImage="arrow.up.circle"
					onPress={() => model.setUpdaterRunTarget(bucket.env.id)}
					modifiers={[disabled(model.anyWorkInFlight(bucket))]}
				/>
			) : null}
			<Button
				label="Recheck All"
				systemImage="arrow.clockwise"
				onPress={() => void model.recheckAll(bucket)}
				modifiers={[disabled(model.rescanningEnvID !== undefined || bucket.loading)]}
			/>
		</Menu>
	);
}

function EnvironmentCard({ model, bucket }: { model: ImageUpdatesModel; bucket: EnvUpdateBucket }) {
	const outdated = model.outdatedImages(bucket);
	let body: ReactNode;
	if (bucket.loading && bucket.images.length === 0) {
		body = (
			<HStack spacing={10} modifiers={[padding({ vertical: 14 })]}>
				<ProgressView modifiers={[controlSize('small')]} />
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					Checking images…
				</Text>
			</HStack>
		);
	} else if (outdated.length === 0) {
		body = (
			<HStack spacing={10} modifiers={[padding({ vertical: 10 })]}>
				<RowIcon systemImage="checkmark" tint={systemColors.green} size={30} />
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{bucket.summary
						? `All ${bucket.summary.totalImages} images up to date`
						: 'All images up to date'}
				</Text>
				<Spacer minLength={0} />
			</HStack>
		);
	} else {
		body = (
			<VStack spacing={0}>
				{outdated.map((item, index) => (
					<VStack key={item.id} spacing={0}>
						<OutdatedImageRow model={model} item={item} bucket={bucket} />
						{index < outdated.length - 1 ? (
							<Divider modifiers={[padding({ leading: 48 })]} />
						) : null}
					</VStack>
				))}
			</VStack>
		);
	}

	return (
		<DashboardCardBackground cornerRadius={Radius.card}>
			<VStack
				alignment="leading"
				spacing={0}
				modifiers={[padding({ all: 20 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}
			>
				<HStack spacing={8} modifiers={[padding({ bottom: 12 })]}>
					<Text
						modifiers={[font({ textStyle: 'headline' }), lineLimit(1), truncationMode('middle')]}
					>
						{environmentDisplayName(bucket.env)}
					</Text>
					<Spacer minLength={8} />
					<EnvironmentMenu model={model} bucket={bucket} hasUpdates={outdated.length > 0} />
				</HStack>
				{bucket.error !== undefined ? (
					<Label
						title={bucket.error}
						systemImage="exclamationmark.triangle"
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle(systemColors.red),
							padding({ bottom: 10 })
						]}
					/>
				) : null}
				{body}
			</VStack>
		</DashboardCardBackground>
	);
}

function AllEnvironmentsUpdatesList({ model }: { model: ImageUpdatesModel }) {
	const updates = model.visibleUpdates;
	const environments = model.filteredBuckets;
	const loading = environments.some((bucket) => bucket.loading);
	const errors = environments.filter((bucket) => bucket.error !== undefined);

	let overlay: ReactNode = null;
	if (updates.length === 0 && errors.length === 0) {
		if (loading) overlay = <ArcaneLoadingViewSwiftUI label="Checking images…" />;
		else if (model.search !== '') {
			overlay = (
				<ContentUnavailableView
					title={`No Results for “${model.search}”`}
					systemImage="magnifyingglass"
					description="Check the spelling or try a new search."
				/>
			);
		} else {
			overlay = (
				<ContentUnavailableView
					title="No Available Updates"
					systemImage="checkmark.circle"
					description="No pending image updates in the selected environments."
				/>
			);
		}
	}

	return (
		<ZStack>
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.loadAll)]}>
				{errors.map((bucket) => (
					<VStack key={bucket.id} alignment="leading" spacing={6}>
						<Label
							title={`Couldn't load ${environmentDisplayName(bucket.env)}`}
							systemImage="exclamationmark.triangle"
						/>
						<Text
							modifiers={[
								font({ textStyle: 'footnote' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{bucket.error ?? ''}
						</Text>
						<Button label="Retry" onPress={() => void model.loadAll()} />
					</VStack>
				))}
				{updates.length > 0 ? (
					<Section
						header={
							<ResourceCountSectionHeader title="Available Updates" loadedCount={updates.length} />
						}
					>
						{updates.map((item) => (
							<OutdatedImageRow
								key={item.id}
								model={model}
								item={item.image}
								bucket={item.bucket}
							/>
						))}
					</Section>
				) : null}
				{loading && updates.length > 0 ? (
					<ArcaneLoadingViewSwiftUI label="Checking images…" />
				) : null}
			</List>
			{overlay}
		</ZStack>
	);
}

function DetailRow({
	label,
	value,
	mono,
	tint: valueTint
}: {
	label: string;
	value: string;
	mono: boolean;
	tint?: string;
}) {
	return (
		<VStack
			alignment="leading"
			spacing={3}
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 10 })]}
		>
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{label}
			</Text>
			<Text
				modifiers={[
					font(mono ? { textStyle: 'footnote', design: 'monospaced' } : { textStyle: 'footnote' }),
					foregroundStyle(valueTint ?? 'primary'),
					textSelection(true),
					...(mono ? [lineLimit(1), truncationMode('middle')] : [])
				]}
			>
				{value}
			</Text>
		</VStack>
	);
}

const groupedPanel = () =>
	background(
		colors.secondarySystemGroupedBackground,
		shapes.roundedRectangle({ cornerRadius: Radius.standard })
	);

function ConsumerRow({
	model,
	consumer,
	item,
	bucket,
	canUpdate
}: {
	model: ImageUpdatesModel;
	consumer: ImageUsedBy;
	item: OutdatedImage;
	bucket: EnvUpdateBucket;
	canUpdate: boolean;
}) {
	const isProject = consumer.type === 'project';
	const consumerTint = isProject ? systemColors.purple : systemColors.blue;
	const isUpdating =
		consumer.id !== undefined && model.updatingKeys.has(rowKey(bucket.id, consumer.id));
	return (
		<HStack spacing={10} modifiers={[padding({ vertical: 10 })]}>
			<RowIcon
				systemImage={isProject ? 'folder.fill' : 'cube.box.fill'}
				tint={consumerTint}
				size={30}
			/>
			<VStack alignment="leading" spacing={1}>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'medium' }),
						lineLimit(1),
						truncationMode('middle')
					]}
				>
					{consumer.name}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
					]}
				>
					{isProject ? 'Project' : 'Container'}
				</Text>
			</VStack>
			<Spacer minLength={8} />
			{isUpdating ? (
				<ProgressView modifiers={[controlSize('small')]} />
			) : canUpdate && consumer.id !== undefined ? (
				<Button
					onPress={() => void model.startConsumerUpdate(consumer, item, bucket)}
					modifiers={[
						buttonStyle('borderless'),
						tint(systemColors.orange),
						disabled(model.anyWorkInFlight(bucket)),
						accessibilityLabel(`Update ${consumer.name}`)
					]}
				>
					<Image
						systemName="arrow.up.circle.fill"
						modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}
					/>
				</Button>
			) : null}
		</HStack>
	);
}

function ImageDetailSheet({
	model,
	target
}: {
	model: ImageUpdatesModel;
	target: ImageDetailTarget;
}) {
	const accent = useAccentColor();
	const state = model.detailState(target);
	const done = (
		<Toolbar.Content>
			<ToolbarItem placement="confirmationAction">
				<Button
					label="Done"
					onPress={() => model.setDetailTarget(undefined)}
					modifiers={[foregroundStyle(accent), tint(accent)]}
				/>
			</ToolbarItem>
		</Toolbar.Content>
	);

	if (state.kind === 'updatedAway') {
		return (
			<Toolbar>
				<VStack
					spacing={16}
					modifiers={[
						padding({ all: 24 }),
						frame({ maxWidth: Infinity, maxHeight: Infinity }),
						background(colors.systemGroupedBackground),
						navigationBarTitleDisplayMode('inline')
					]}
				>
					<ZStack>
						<Image
							systemName="checkmark.circle.fill"
							modifiers={[
								font({ size: 32, weight: 'semibold' }),
								foregroundStyle(systemColors.green),
								frame({ width: 72, height: 72 }),
								background(withOpacity(systemColors.green, 0.14), shapes.circle())
							]}
						/>
					</ZStack>
					<Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>All Set</Text>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							multilineTextAlignment('center')
						]}
					>
						This image was updated and replaced by a newer version.
					</Text>
				</VStack>
				{done}
			</Toolbar>
		);
	}

	const { item, hasUpdate, bucket } = state;
	const isUpdating = model.updatingKeys.has(rowKey(bucket.id, item.image.id));
	const actionable = model.actionableConsumers(item);
	const consumers = OutdatedImage.consumers(item);
	const name = OutdatedImage.repoDisplayName(item);
	const heroTint = hasUpdate ? systemColors.orange : systemColors.green;
	const rows: { label: string; value: string; mono: boolean; tint?: string }[] = [
		{ label: 'Image', value: item.ref, mono: true }
	];
	if (item.info.currentVersion !== '')
		rows.push({ label: 'Current', value: item.info.currentVersion, mono: true });
	if (item.info.latestVersion)
		rows.push({
			label: 'Latest',
			value: item.info.latestVersion,
			mono: true,
			tint: hasUpdate ? systemColors.orange : undefined
		});
	if (item.info.currentDigest)
		rows.push({ label: 'Current digest', value: item.info.currentDigest, mono: true });
	if (item.info.latestDigest) {
		rows.push({
			label: 'New digest',
			value: item.info.latestDigest,
			mono: true,
			tint: hasUpdate ? systemColors.orange : undefined
		});
	}
	if (item.info.error)
		rows.push({ label: 'Error', value: item.info.error, mono: false, tint: systemColors.red });

	return (
		<Toolbar>
			<ScrollView
				modifiers={[
					background(colors.systemGroupedBackground),
					navigationTitle(name),
					navigationBarTitleDisplayMode('inline')
				]}
			>
				<VStack spacing={16} modifiers={[padding({ all: 16 })]}>
					<HStack
						spacing={14}
						modifiers={[
							padding({ all: 16 }),
							frame({ maxWidth: Infinity, alignment: 'leading' }),
							groupedPanel()
						]}
					>
						<Image
							systemName={hasUpdate ? 'arrow.up.circle.fill' : 'checkmark.circle.fill'}
							modifiers={[
								font({ size: 24, weight: 'semibold' }),
								foregroundStyle(heroTint),
								frame({ width: 52, height: 52 }),
								background(withOpacity(heroTint, 0.14), shapes.circle())
							]}
						/>
						<VStack alignment="leading" spacing={3}>
							<HStack spacing={6}>
								<Text
									modifiers={[
										font({ textStyle: 'headline' }),
										lineLimit(1),
										truncationMode('middle')
									]}
								>
									{name}
								</Text>
								<UpdateTypeBadge info={item.info} />
							</HStack>
							<Text
								modifiers={[
									font({ textStyle: 'subheadline' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{hasUpdate ? 'Update available' : 'Up to date'}
							</Text>
						</VStack>
						<Spacer minLength={0} />
					</HStack>

					<VStack
						alignment="leading"
						spacing={0}
						modifiers={[padding({ horizontal: 16 }), groupedPanel()]}
					>
						{rows.map((row, index) => (
							<VStack key={row.label} spacing={0}>
								{index > 0 ? <Divider /> : null}
								<DetailRow label={row.label} value={row.value} mono={row.mono} tint={row.tint} />
							</VStack>
						))}
					</VStack>

					{consumers.length > 0 ? (
						<VStack alignment="leading" spacing={4}>
							<Text
								modifiers={[
									font({ textStyle: 'subheadline', weight: 'semibold' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
									padding({ horizontal: 4 })
								]}
							>
								Used By
							</Text>
							<VStack spacing={0} modifiers={[padding({ horizontal: 16 }), groupedPanel()]}>
								{consumers.map((consumer, index) => (
									<VStack key={`${index}`} spacing={0}>
										<ConsumerRow
											model={model}
											consumer={consumer}
											item={item}
											bucket={bucket}
											canUpdate={hasUpdate}
										/>
										{index < consumers.length - 1 ? (
											<Divider modifiers={[padding({ leading: 38 })]} />
										) : null}
									</VStack>
								))}
							</VStack>
						</VStack>
					) : !item.image.inUse ? (
						<Label
							title="Not used by any container"
							systemImage="moon.zzz"
							modifiers={[
								font({ textStyle: 'subheadline' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
								frame({ maxWidth: Infinity, alignment: 'leading' }),
								padding({ all: 16 }),
								groupedPanel()
							]}
						/>
					) : null}

					<HStack spacing={10} modifiers={[padding({ top: 4 })]}>
						<Button
							onPress={() => void model.recheck(bucket, item.ref)}
							modifiers={[buttonStyle('bordered'), buttonBorderShape('capsule')]}
						>
							{model.checkingKeys.has(rowKey(bucket.id, item.ref)) ? (
								<HStack spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
									<ProgressView modifiers={[controlSize('small')]} />
									<Text>Checking…</Text>
								</HStack>
							) : (
								<Label
									title="Recheck"
									systemImage="arrow.clockwise"
									modifiers={[frame({ maxWidth: Infinity })]}
								/>
							)}
						</Button>
						{hasUpdate && actionable.length > 0 ? (
							<Button
								onPress={() => void model.startImageUpdate(item, bucket)}
								modifiers={[
									buttonStyle('borderedProminent'),
									buttonBorderShape('capsule'),
									tint(systemColors.orange),
									disabled(model.anyWorkInFlight(bucket))
								]}
							>
								{isUpdating ? (
									<HStack spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
										<ProgressView modifiers={[controlSize('small')]} />
										<Text>Updating…</Text>
									</HStack>
								) : (
									<Label
										title={actionable.length === 1 ? 'Update' : `Update All (${actionable.length})`}
										systemImage="arrow.up.circle.fill"
										modifiers={[frame({ maxWidth: Infinity })]}
									/>
								)}
							</Button>
						) : null}
					</HStack>
				</VStack>
			</ScrollView>
			{done}
		</Toolbar>
	);
}

function FilterSheet({ model }: { model: ImageUpdatesModel }) {
	const accent = useAccentColor();
	return (
		<Toolbar>
			<Form modifiers={[navigationTitle('Filter'), navigationBarTitleDisplayMode('inline')]}>
				<Section title="Sort">
					<Picker
						label="Sort"
						selection={model.sortOrder}
						onSelectionChange={(value: ListSortOrder) => model.setSortOrder(value)}
						modifiers={[pickerStyle('inline'), labelsHidden()]}
					>
						{ListSortOrder.allCases.map((order) => (
							<Label
								key={order}
								title={ListSortOrder.title(order)}
								systemImage={ListSortOrder.systemImage(order) as SFSymbol}
								modifiers={[tag(order)]}
							/>
						))}
					</Picker>
				</Section>
				<EnvironmentFilterSection
					environments={model.buckets.map((bucket) => ({
						id: bucket.id,
						name: environmentDisplayName(bucket.env)
					}))}
					selection={model.environmentFilter}
					onSelectionChange={model.setEnvironmentFilter}
				/>
			</Form>
			<Toolbar.Content>
				<ToolbarItem placement="confirmationAction">
					<Button
						label="Done"
						onPress={() => model.setShowsFilters(false)}
						modifiers={[foregroundStyle(accent), tint(accent)]}
					/>
				</ToolbarItem>
			</Toolbar.Content>
		</Toolbar>
	);
}

export type ImageUpdatesViewProps = {
	dismissOnOperationStart?: boolean;
	onDismiss?: () => void;
	historyAction?: ActionButtonItem;
	sheets?: ReactNode;
};

export function ImageUpdatesView({
	dismissOnOperationStart = false,
	onDismiss,
	historyAction,
	sheets
}: ImageUpdatesViewProps) {
	const model = useImageUpdates({ dismissOnOperationStart, onDismiss });
	const accent = useAccentColor();
	const filterIcon =
		model.environmentFilter !== undefined
			? 'line.3.horizontal.decrease.circle.fill'
			: 'line.3.horizontal.decrease.circle';
	const icon = useToolbarIcons([filterIcon, 'ellipsis.circle', historyAction?.systemImage ?? '']);

	let content: ReactNode;
	if (!model.hasLoadedOnce && model.isLoading) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading updates…" />
			</VStack>
		);
	} else if (model.environmentLoadError !== undefined && model.buckets.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Environments"
				systemImage="exclamationmark.triangle"
				description={model.environmentLoadError}
				actions={[{ title: 'Try Again', onPress: () => void model.loadAll() }]}
			/>
		);
	} else if (model.hasLoadedOnce && model.buckets.length === 0) {
		content = (
			<ContentUnavailableView
				title="No Environments"
				systemImage="bolt.slash"
				description="Add an environment to see image updates."
			/>
		);
	} else if (model.allEnvironmentsPreview) {
		content = <AllEnvironmentsUpdatesList model={model} />;
	} else {
		content = (
			<ScrollView
				modifiers={[background(colors.systemGroupedBackground), refreshable(model.loadAll)]}
			>
				<LazyVStack spacing={16} modifiers={[padding({ horizontal: 16, vertical: 16 })]}>
					<ResourceCountSectionHeader
						title="Available Updates"
						loadedCount={model.updateItemCount}
					/>
					{model.buckets.map((bucket) => (
						<EnvironmentCard key={bucket.id} model={model} bucket={bucket} />
					))}
				</LazyVStack>
			</ScrollView>
		);
	}

	const [detailTarget, setDetailTarget] = useState(model.detailTarget);
	if (model.detailTarget && model.detailTarget !== detailTarget)
		setDetailTarget(model.detailTarget);
	const [updaterRunTarget, setUpdaterRunTarget] = useState(model.updaterRunTarget);
	if (model.updaterRunTarget !== undefined && model.updaterRunTarget !== updaterRunTarget)
		setUpdaterRunTarget(model.updaterRunTarget);

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Updates',
					headerLargeTitleEnabled: false,
					headerSearchBarOptions: model.allEnvironmentsPreview
						? {
								placeholder: 'Search images or environments',
								hideWhenScrolling: false,
								onChangeText: (event) => model.setSearch(event.nativeEvent.text),
								onCancelButtonPress: () => model.setSearch('')
							}
						: undefined
				}}
			/>
			{model.allEnvironmentsPreview ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Button
						icon={icon(filterIcon)}
						accessibilityLabel="Filter"
						onPress={() => model.setShowsFilters(true)}
					/>
					<Stack.Toolbar.Menu
						icon={icon('ellipsis.circle')}
						accessibilityLabel="More options"
						disabled={model.buckets.length === 0}
					>
						<Stack.Toolbar.MenuAction
							icon="arrow.triangle.2.circlepath"
							onPress={() => model.setPendingMaintenanceAction('update')}
						>
							Update All
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.MenuAction
							icon="arrow.clockwise"
							onPress={() => model.setPendingMaintenanceAction('checkImages')}
						>
							Check All
						</Stack.Toolbar.MenuAction>
						{historyAction ? (
							<Stack.Toolbar.Menu inline>
								<Stack.Toolbar.MenuAction
									icon={historyAction.systemImage as SFSymbol}
									onPress={historyAction.action}
								>
									{historyAction.title}
								</Stack.Toolbar.MenuAction>
							</Stack.Toolbar.Menu>
						) : null}
					</Stack.Toolbar.Menu>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<ZStack>
					{content}
					<BottomSheet isPresented={model.showsFilters} onIsPresentedChange={model.setShowsFilters}>
						<Group
							modifiers={[
								presentationDetents(['medium', 'large']),
								presentationDragIndicator('visible')
							]}
						>
							<NavigationStack>
								<FilterSheet model={model} />
							</NavigationStack>
						</Group>
					</BottomSheet>
					<BottomSheet
						isPresented={model.updaterRunTarget !== undefined}
						onIsPresentedChange={(presented) => {
							if (!presented) model.setUpdaterRunTarget(undefined);
						}}
					>
						{updaterRunTarget !== undefined ? (
							<UpdaterRunSheet
								environments={[]}
								initialEnvironmentID={updaterRunTarget}
								onDismiss={() => model.setUpdaterRunTarget(undefined)}
							/>
						) : (
							<Group>{null}</Group>
						)}
					</BottomSheet>
					<BottomSheet
						isPresented={model.detailTarget !== undefined}
						onIsPresentedChange={(presented) => {
							if (!presented) model.setDetailTarget(undefined);
						}}
					>
						<Group
							modifiers={[
								presentationDetents(['medium', 'large']),
								presentationDragIndicator('visible')
							]}
						>
							<NavigationStack>
								{detailTarget ? (
									<ImageDetailSheet model={model} target={detailTarget} />
								) : (
									<Group>{null}</Group>
								)}
							</NavigationStack>
						</Group>
					</BottomSheet>
					{sheets}
				</ZStack>
			</Host>
		</>
	);
}
