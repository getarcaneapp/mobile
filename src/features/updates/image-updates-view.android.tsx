import { MenuView } from '@react-native-menu/menu';
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { M3Section, RadioGroup } from '@/features/containers/android-material';
import { useEnvironmentRowColor } from '@/features/containers/hooks';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import { MaterialSheet } from '@/features/dashboard/components/material-sheet';
import { ListSortOrder } from '@/core/list-sort-order';
import { withCleanup } from '@/core/with-cleanup';
import type { ImageUsedBy } from '@/sdk/models/image/ImageSummary';
import type { ImageUpdateResponse } from '@/sdk/models/imageUpdate/ImageUpdate';
import { environmentDisplayName } from '@/stores/environments-store';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { EnvironmentFilterSection, EnvironmentLabel } from '@/ui/components/environment-label';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { DashboardCard } from '@/ui/components/surfaces';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { SheetHeader } from './android-sheet-header';
import { OutdatedImage, rowKey, updateTypeBadge, type EnvUpdateBucket } from './updates-logic';
import { UpdaterRunSheet } from './updater-run';
import {
	useImageUpdates,
	type ImageDetailTarget,
	type ImageUpdatesModel
} from './use-image-updates';

const ripple = () => ({ color: colors.separator as string });

function UpdateTypeBadge({ info }: { info: ImageUpdateResponse }) {
	const badge = updateTypeBadge(info);
	if (!badge) return null;
	return (
		<Text
			style={[
				m3Type.labelSmall,
				{
					color: badge.tint,
					fontWeight: '700',
					paddingHorizontal: 6,
					paddingVertical: 2,
					borderRadius: 999,
					overflow: 'hidden',
					backgroundColor: withOpacity(badge.tint, 0.13)
				}
			]}
		>
			{badge.text}
		</Text>
	);
}

function IconAction({
	icon,
	label,
	color,
	disabled,
	onPress,
	size = 24
}: {
	icon: string;
	label: string;
	color?: string;
	disabled?: boolean;
	onPress: () => void;
	size?: number;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ ...ripple(), borderless: true, radius: 20 }}
			style={{
				width: 40,
				height: 40,
				alignItems: 'center',
				justifyContent: 'center',
				opacity: disabled ? 0.38 : 1
			}}
		>
			<Icon name={icon} size={size} color={color ?? (m3.primary as string)} />
		</Pressable>
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
	const checking = model.checkingKeys.has(rowKey(bucket.id, item.ref));

	const menu: RowMenuItem[] = [];
	if (actionable.length > 0)
		menu.push({
			id: 'update',
			title: 'Update Image',
			disabled: busy,
			onPress: () => void model.startImageUpdate(item, bucket)
		});
	menu.push({
		id: 'recheck',
		title: 'Recheck Registry',
		disabled: model.rescanningEnvID !== undefined,
		onPress: () => void model.recheck(bucket, item.ref)
	});
	menu.push({ id: 'copy', title: 'Copy Image Ref', onPress: () => model.copyRef(item) });

	return (
		<View
			style={{ flexDirection: 'row', alignItems: 'center', paddingRight: allEnvironments ? 8 : 0 }}
		>
			<LongPressMenu
				items={menu}
				title={name}
				onPress={() => model.setDetailTarget({ envID: bucket.id, imageID: item.image.id })}
				style={{
					flex: 1,
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					paddingVertical: 10,
					paddingLeft: allEnvironments ? 16 : 0
				}}
			>
				<RowIcon systemImage="square.3.layers.3d.top.filled" tint={systemColors.orange} />
				<View style={{ flex: 1, gap: 3 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
						<Text
							style={[
								allEnvironments ? m3Type.bodyLarge : m3Type.titleSmall,
								{ color: colors.label, flexShrink: 1 }
							]}
							numberOfLines={1}
							ellipsizeMode="middle"
						>
							{name}
						</Text>
						<UpdateTypeBadge info={item.info} />
					</View>
					<Text
						style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
						numberOfLines={1}
						ellipsizeMode="middle"
					>
						{OutdatedImage.versionChange(item)}
					</Text>
					{allEnvironments ? (
						<EnvironmentLabel name={environmentDisplayName(bucket.env)} color={environmentColor} />
					) : null}
				</View>
			</LongPressMenu>
			{isUpdating ? (
				<View style={{ width: 40, alignItems: 'center' }}>
					<ActivityIndicator size="small" />
				</View>
			) : actionable.length > 0 ? (
				<IconAction
					icon="arrow.up.circle.fill"
					label={`Update ${name}`}
					color={systemColors.orange}
					disabled={busy}
					onPress={() => void model.startImageUpdate(item, bucket)}
				/>
			) : checking ? (
				<View style={{ width: 40, alignItems: 'center' }}>
					<ActivityIndicator size="small" />
				</View>
			) : (
				<IconAction
					icon="arrow.clockwise"
					label="Recheck"
					size={18}
					disabled={model.rescanningEnvID !== undefined}
					onPress={() => void model.recheck(bucket, item.ref)}
				/>
			)}
		</View>
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
	if (model.rescanningEnvID === bucket.id)
		return <ActivityIndicator size="small" style={{ width: 40, height: 40 }} />;
	const actions = [
		...(hasUpdates
			? [
					{
						id: 'update-all',
						title: 'Update All',
						attributes: { disabled: model.anyWorkInFlight(bucket) }
					}
				]
			: []),
		{
			id: 'recheck-all',
			title: 'Recheck All',
			attributes: { disabled: model.rescanningEnvID !== undefined || bucket.loading }
		}
	];
	return (
		<MenuView
			actions={actions}
			onPressAction={({ nativeEvent }) => {
				if (nativeEvent.event === 'update-all') model.setUpdaterRunTarget(bucket.env.id);
				else void model.recheckAll(bucket);
			}}
		>
			<View
				accessible
				accessibilityRole="button"
				accessibilityLabel="Environment actions"
				style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
			>
				<Icon name="ellipsis.circle" size={22} color={colors.secondaryLabel} />
			</View>
		</MenuView>
	);
}

function EnvironmentCard({ model, bucket }: { model: ImageUpdatesModel; bucket: EnvUpdateBucket }) {
	const outdated = model.outdatedImages(bucket);
	let body: ReactNode;
	if (bucket.loading && bucket.images.length === 0) {
		body = (
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
				<ActivityIndicator size="small" />
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>Checking images…</Text>
			</View>
		);
	} else if (outdated.length === 0) {
		body = (
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
				<RowIcon systemImage="checkmark" tint={systemColors.green} size={30} />
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
					{bucket.summary
						? `All ${bucket.summary.totalImages} images up to date`
						: 'All images up to date'}
				</Text>
			</View>
		);
	} else {
		body = outdated.map((item, index) => (
			<View key={item.id}>
				<OutdatedImageRow model={model} item={item} bucket={bucket} />
				{index < outdated.length - 1 ? (
					<View style={{ height: 1, marginLeft: 48, backgroundColor: colors.separator }} />
				) : null}
			</View>
		));
	}
	return (
		<DashboardCard cornerRadius={Radius.card} style={{ padding: 20 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
				<Text
					style={[m3Type.titleMedium, { color: colors.label, flex: 1 }]}
					numberOfLines={1}
					ellipsizeMode="middle"
				>
					{environmentDisplayName(bucket.env)}
				</Text>
				<EnvironmentMenu model={model} bucket={bucket} hasUpdates={outdated.length > 0} />
			</View>
			{bucket.error !== undefined ? (
				<View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
					<Icon name="exclamationmark.triangle" size={14} color={systemColors.red} />
					<Text style={[m3Type.bodySmall, { color: systemColors.red, flex: 1 }]}>
						{bucket.error}
					</Text>
				</View>
			) : null}
			{body}
		</DashboardCard>
	);
}

function CenteredState({
	icon,
	title,
	message,
	action
}: {
	icon: string;
	title: string;
	message?: string;
	action?: { title: string; onPress: () => void };
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
			{action ? (
				<Pressable
					onPress={action.onPress}
					accessibilityRole="button"
					style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 10 }}
				>
					<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{action.title}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function AllEnvironmentsUpdatesList({ model }: { model: ImageUpdatesModel }) {
	const updates = model.visibleUpdates;
	const environments = model.filteredBuckets;
	const loading = environments.some((bucket) => bucket.loading);
	const errors = environments.filter((bucket) => bucket.error !== undefined);

	if (updates.length === 0 && errors.length === 0) {
		if (loading) {
			return (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
					<ArcaneLoadingView label="Checking images…" />
				</View>
			);
		}
		if (model.search !== '') {
			return (
				<CenteredState
					icon="magnifyingglass"
					title={`No Results for “${model.search}”`}
					message="Check the spelling or try a new search."
				/>
			);
		}
		return (
			<CenteredState
				icon="checkmark.circle"
				title="No Available Updates"
				message="No pending image updates in the selected environments."
			/>
		);
	}

	return (
		<View>
			{errors.map((bucket) => (
				<View key={bucket.id} style={{ paddingTop: 12 }}>
					<MaterialListGroup>
						<View style={{ padding: 16, gap: 6 }}>
							<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
								<Icon name="exclamationmark.triangle" size={18} color={colors.label} />
								<Text
									style={[m3Type.bodyLarge, { color: colors.label }]}
								>{`Couldn't load ${environmentDisplayName(bucket.env)}`}</Text>
							</View>
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{bucket.error ?? ''}
							</Text>
							<Pressable
								onPress={() => void model.loadAll()}
								accessibilityRole="button"
								style={{ paddingVertical: 6 }}
							>
								<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Retry</Text>
							</Pressable>
						</View>
					</MaterialListGroup>
				</View>
			))}
			{updates.length > 0 ? (
				<View>
					<View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 }}>
						<ResourceCountSectionHeader title="Available Updates" loadedCount={updates.length} />
					</View>
					<MaterialListGroup>
						{updates.map((item) => (
							<OutdatedImageRow
								key={item.id}
								model={model}
								item={item.image}
								bucket={item.bucket}
							/>
						))}
					</MaterialListGroup>
				</View>
			) : null}
			{loading && updates.length > 0 ? (
				<View style={{ padding: 16, alignItems: 'center' }}>
					<ArcaneLoadingView label="Checking images…" variant="inline" />
				</View>
			) : null}
		</View>
	);
}

function Panel({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
	return (
		<View
			style={{
				borderRadius: Radius.standard,
				backgroundColor: m3.surfaceContainerHigh,
				paddingHorizontal: 16,
				paddingVertical: padded ? 16 : 0
			}}
		>
			{children}
		</View>
	);
}

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
	const isUpdating =
		consumer.id !== undefined && model.updatingKeys.has(rowKey(bucket.id, consumer.id));
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
			<RowIcon
				systemImage={isProject ? 'folder.fill' : 'cube.box.fill'}
				tint={isProject ? systemColors.purple : systemColors.blue}
				size={30}
			/>
			<View style={{ flex: 1, gap: 1 }}>
				<Text
					style={[m3Type.bodyMedium, { color: colors.label, fontWeight: '500' }]}
					numberOfLines={1}
					ellipsizeMode="middle"
				>
					{consumer.name}
				</Text>
				<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}>
					{isProject ? 'Project' : 'Container'}
				</Text>
			</View>
			{isUpdating ? (
				<ActivityIndicator size="small" />
			) : canUpdate && consumer.id !== undefined ? (
				<IconAction
					icon="arrow.up.circle.fill"
					label={`Update ${consumer.name}`}
					color={systemColors.orange}
					disabled={model.anyWorkInFlight(bucket)}
					onPress={() => void model.startConsumerUpdate(consumer, item, bucket)}
				/>
			) : null}
		</View>
	);
}

function PillButton({
	title,
	icon,
	onPress,
	prominent,
	disabled,
	busy
}: {
	title: string;
	icon: string;
	onPress: () => void;
	prominent?: boolean;
	disabled?: boolean;
	busy?: boolean;
}) {
	const fg = prominent ? '#FFFFFF' : (m3.primary as string);
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			android_ripple={ripple()}
			style={{
				flex: 1,
				minHeight: 44,
				borderRadius: 22,
				overflow: 'hidden',
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 6,
				opacity: disabled ? 0.38 : 1,
				backgroundColor: prominent ? systemColors.orange : m3.secondaryContainer
			}}
		>
			{busy ? (
				<ActivityIndicator size="small" color={fg} />
			) : (
				<Icon name={icon} size={18} color={fg} />
			)}
			<Text style={[m3Type.labelLarge, { color: fg }]}>{title}</Text>
		</Pressable>
	);
}

function ImageDetailSheet({
	model,
	target
}: {
	model: ImageUpdatesModel;
	target: ImageDetailTarget;
}) {
	const state = model.detailState(target);
	const close = () => model.setDetailTarget(undefined);
	if (state.kind === 'updatedAway') {
		return (
			<View style={{ paddingBottom: 32 }}>
				<SheetHeader title="" actionTitle="Done" onAction={close} />
				<View style={{ alignItems: 'center', gap: 16, padding: 24 }}>
					<View
						style={{
							width: 72,
							height: 72,
							borderRadius: 36,
							backgroundColor: withOpacity(systemColors.green, 0.14),
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<Icon name="checkmark.circle.fill" size={32} color={systemColors.green} />
					</View>
					<Text style={[m3Type.titleLarge, { color: colors.label, fontWeight: '700' }]}>
						All Set
					</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
						This image was updated and replaced by a newer version.
					</Text>
				</View>
			</View>
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
	if (item.info.latestDigest)
		rows.push({
			label: 'New digest',
			value: item.info.latestDigest,
			mono: true,
			tint: hasUpdate ? systemColors.orange : undefined
		});
	if (item.info.error)
		rows.push({ label: 'Error', value: item.info.error, mono: false, tint: systemColors.red });

	return (
		<View style={{ paddingBottom: 24 }}>
			<SheetHeader title={name} actionTitle="Done" onAction={close} />
			<ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
				<Panel>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
						<View
							style={{
								width: 52,
								height: 52,
								borderRadius: 26,
								backgroundColor: withOpacity(heroTint, 0.14),
								alignItems: 'center',
								justifyContent: 'center'
							}}
						>
							<Icon
								name={hasUpdate ? 'arrow.up.circle.fill' : 'checkmark.circle.fill'}
								size={24}
								color={heroTint}
							/>
						</View>
						<View style={{ flex: 1, gap: 3 }}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
								<Text
									style={[m3Type.titleMedium, { color: colors.label, flexShrink: 1 }]}
									numberOfLines={1}
									ellipsizeMode="middle"
								>
									{name}
								</Text>
								<UpdateTypeBadge info={item.info} />
							</View>
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								{hasUpdate ? 'Update available' : 'Up to date'}
							</Text>
						</View>
					</View>
				</Panel>
				<Panel padded={false}>
					{rows.map((row, index) => (
						<View key={row.label}>
							{index > 0 ? <View style={{ height: 1, backgroundColor: colors.separator }} /> : null}
							<View style={{ paddingVertical: 10, gap: 3 }}>
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									{row.label}
								</Text>
								<Text
									selectable
									style={[
										m3Type.bodySmall,
										{
											color: row.tint ?? colors.label,
											fontFamily: row.mono ? monoFamily : undefined
										}
									]}
								>
									{row.value}
								</Text>
							</View>
						</View>
					))}
				</Panel>
				{consumers.length > 0 ? (
					<View style={{ gap: 4 }}>
						<Text
							style={[m3Type.titleSmall, { color: colors.secondaryLabel, paddingHorizontal: 4 }]}
						>
							Used By
						</Text>
						<Panel padded={false}>
							{consumers.map((consumer, index) => (
								<View key={`${index}`}>
									<ConsumerRow
										model={model}
										consumer={consumer}
										item={item}
										bucket={bucket}
										canUpdate={hasUpdate}
									/>
									{index < consumers.length - 1 ? (
										<View
											style={{ height: 1, marginLeft: 38, backgroundColor: colors.separator }}
										/>
									) : null}
								</View>
							))}
						</Panel>
					</View>
				) : !item.image.inUse ? (
					<Panel>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
							<Icon name="moon.zzz" size={18} color={colors.secondaryLabel} />
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								Not used by any container
							</Text>
						</View>
					</Panel>
				) : null}
				<View style={{ flexDirection: 'row', gap: 10, paddingTop: 4 }}>
					<PillButton
						title={model.checkingKeys.has(rowKey(bucket.id, item.ref)) ? 'Checking…' : 'Recheck'}
						icon="arrow.clockwise"
						busy={model.checkingKeys.has(rowKey(bucket.id, item.ref))}
						onPress={() => void model.recheck(bucket, item.ref)}
					/>
					{hasUpdate && actionable.length > 0 ? (
						<PillButton
							title={
								isUpdating
									? 'Updating…'
									: actionable.length === 1
										? 'Update'
										: `Update All (${actionable.length})`
							}
							icon="arrow.up.circle.fill"
							prominent
							busy={isUpdating}
							disabled={model.anyWorkInFlight(bucket)}
							onPress={() => void model.startImageUpdate(item, bucket)}
						/>
					) : null}
				</View>
			</ScrollView>
		</View>
	);
}

function FilterSheet({ model }: { model: ImageUpdatesModel }) {
	return (
		<View style={{ paddingBottom: 24 }}>
			<SheetHeader
				title="Filter"
				actionTitle="Done"
				onAction={() => model.setShowsFilters(false)}
			/>
			<M3Section title="Sort">
				<RadioGroup
					options={ListSortOrder.allCases.map((order) => ({
						value: order,
						title: ListSortOrder.title(order),
						icon: ListSortOrder.systemImage(order)
					}))}
					selection={model.sortOrder}
					onSelect={model.setSortOrder}
				/>
			</M3Section>
			<EnvironmentFilterSection
				environments={model.buckets.map((bucket) => ({
					id: bucket.id,
					name: environmentDisplayName(bucket.env)
				}))}
				selection={model.environmentFilter}
				onSelectionChange={model.setEnvironmentFilter}
			/>
		</View>
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
	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			async () => {
				await model.loadAll();
			},
			() => setRefreshing(false)
		);
	};

	let content: ReactNode;
	if (!model.hasLoadedOnce && model.isLoading) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading updates…" />
			</View>
		);
	} else if (model.environmentLoadError !== undefined && model.buckets.length === 0) {
		content = (
			<CenteredState
				icon="exclamationmark.triangle"
				title="Couldn't Load Environments"
				message={model.environmentLoadError}
				action={{ title: 'Try Again', onPress: () => void model.loadAll() }}
			/>
		);
	} else if (model.hasLoadedOnce && model.buckets.length === 0) {
		content = (
			<CenteredState
				icon="bolt.slash"
				title="No Environments"
				message="Add an environment to see image updates."
			/>
		);
	} else if (model.allEnvironmentsPreview) {
		content = <AllEnvironmentsUpdatesList model={model} />;
	} else {
		content = (
			<View style={{ padding: 16, gap: 16 }}>
				<ResourceCountSectionHeader title="Available Updates" loadedCount={model.updateItemCount} />
				{model.buckets.map((bucket) => (
					<EnvironmentCard key={bucket.id} model={model} bucket={bucket} />
				))}
			</View>
		);
	}

	const detailTarget = model.detailTarget;
	const updaterRunTarget = model.updaterRunTarget;
	const filterIcon =
		model.environmentFilter !== undefined
			? 'line.3.horizontal.decrease.circle.fill'
			: 'line.3.horizontal.decrease.circle';

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Updates',
					headerSearchBarOptions: model.allEnvironmentsPreview
						? {
								placeholder: 'Search images or environments',
								onChangeText: (event) => model.setSearch(event.nativeEvent.text),
								onClose: () => model.setSearch('')
							}
						: undefined
				}}
			/>
			{model.allEnvironmentsPreview ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'filter',
							icon: filterIcon,
							label: 'Filter',
							onPress: () => model.setShowsFilters(true)
						},
						{
							kind: 'menu',
							id: 'more',
							icon: 'ellipsis.circle',
							label: 'More options',
							disabled: model.buckets.length === 0,
							items: [
								{
									id: 'update-all',
									title: 'Update All',
									onPress: () => model.setPendingMaintenanceAction('update')
								},
								{
									id: 'check-all',
									title: 'Check All',
									onPress: () => model.setPendingMaintenanceAction('checkImages')
								},
								...(historyAction
									? [
											{
												id: historyAction.id,
												title: historyAction.title,
												onPress: historyAction.action
											}
										]
									: [])
							]
						}
					]}
				/>
			) : null}
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
			<MaterialSheet
				isPresented={model.showsFilters}
				onDismiss={() => model.setShowsFilters(false)}
			>
				<FilterSheet model={model} />
			</MaterialSheet>
			<MaterialSheet
				isPresented={updaterRunTarget !== undefined}
				onDismiss={() => model.setUpdaterRunTarget(undefined)}
			>
				{updaterRunTarget !== undefined ? (
					<UpdaterRunSheet
						environments={[]}
						initialEnvironmentID={updaterRunTarget}
						onDismiss={() => model.setUpdaterRunTarget(undefined)}
					/>
				) : null}
			</MaterialSheet>
			<MaterialSheet
				isPresented={detailTarget !== undefined}
				onDismiss={() => model.setDetailTarget(undefined)}
			>
				{detailTarget ? <ImageDetailSheet model={model} target={detailTarget} /> : null}
			</MaterialSheet>
			{sheets}
		</>
	);
}
