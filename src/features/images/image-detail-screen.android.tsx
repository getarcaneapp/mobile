/** Android rendering of `ImageDetailView` (ImageDetailView.swift). */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';
import { containerDisplayName, containerIsRunning } from '@/features/containers/container-model';
import { ImageVulnerabilitiesView } from '@/features/images/security/image-vulnerabilities-view';
import { canPatchImage, useSecurityNavigation } from '@/features/images/security/security-routes';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { UpdateStateBadge } from '@/ui/components/labels';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import type { ActionButtonItem } from '@/ui/components/toolbar';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

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

function LinkItem({
	title,
	onPress,
	leading
}: {
	title: string;
	onPress: () => void;
	leading?: React.ReactNode;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
				minHeight: 52,
				paddingHorizontal: 16
			}}
		>
			{leading}
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<Icon name="chevron.right" size={16} color={colors.secondaryLabel} />
		</Pressable>
	);
}

function ImageHeader({ model }: { model: ImageDetailModel }) {
	const { details } = model;
	const caption = [m3Type.labelSmall, { color: colors.secondaryLabel }];
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
			<View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
				<Icon name="square.3.layers.3d.top.filled" size={28} color={systemColors.purple} />
			</View>
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={[m3Type.titleMedium, { color: colors.label }]}>{model.displayName}</Text>
				<Text
					numberOfLines={1}
					ellipsizeMode="middle"
					style={{ fontFamily: monoFamily, fontSize: 11, color: colors.secondaryLabel }}
				>
					{model.image.id}
				</Text>
				<Text style={caption}>{byteString(model.image.size)}</Text>
				{details ? (
					<>
						<Text style={caption}>{`${details.os}/${details.architecture}`}</Text>
						<Text style={caption}>{headerDate(details.created)}</Text>
					</>
				) : null}
				{model.isCheckingUpdate ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
						<ActivityIndicator size="small" />
						<Text style={caption}>Checking…</Text>
					</View>
				) : model.updateState.kind !== 'unknown' ? (
					<UpdateStateBadge state={model.updateState} />
				) : null}
				{model.versionChange ? <Text style={caption}>{model.versionChange}</Text> : null}
			</View>
		</View>
	);
}

function OverviewTab({ model }: { model: ImageDetailModel }) {
	const [refreshing, setRefreshing] = useState(false);
	const { details, usingContainers } = model;
	const configRows = details ? imageConfigRows(details.config) : [];
	return (
		<ScrollView
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 32 }}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={() => {
						setRefreshing(true);
						void model.refresh().finally(() => setRefreshing(false));
					}}
				/>
			}
		>
			<M3Section>
				<ImageHeader model={model} />
			</M3Section>
			{details ? (
				<>
					<M3Section title="Overview">
						{model.metadataItems(details).map((item) => (
							<ValueRow key={item.label} title={item.label} value={item.value} />
						))}
					</M3Section>
					<M3Section title="Identity">
						<ValueRow title="Image ID" value={details.id} monospaced />
						{details.repoTags.length > 0 ? (
							<ValueRow title="Tags" value={details.repoTags.join('\n')} monospaced />
						) : null}
					</M3Section>
				</>
			) : model.isLoading ? (
				<View style={{ padding: 24, alignItems: 'center' }}>
					<ArcaneLoadingView />
				</View>
			) : null}
			{usingContainers.length > 0 ? (
				<M3Section title={`Used By (${usingContainers.length})`}>
					{usingContainers.map((container) => (
						<LinkItem
							key={container.id}
							title={containerDisplayName(container)}
							onPress={() => model.openContainer(container)}
							leading={
								<StatusIcon status={container.status} isLive={containerIsRunning(container)} />
							}
						/>
					))}
				</M3Section>
			) : null}
			{details && details.repoTags.length > 1 ? (
				<M3Section title="Tags">
					{details.repoTags.map((tag) => (
						<Text
							key={tag}
							selectable
							style={{
								fontFamily: monoFamily,
								fontSize: 12,
								color: colors.label,
								paddingHorizontal: 16,
								paddingVertical: 12
							}}
						>
							{tag}
						</Text>
					))}
				</M3Section>
			) : null}
			{configRows.length > 0 ? (
				<M3Section title="Image Config">
					{configRows.map((row) =>
						row.kind === 'link' ? (
							<LinkItem
								key={row.title}
								title={row.title}
								onPress={() => model.openConfigPage(row.page)}
							/>
						) : (
							<ValueRow
								key={row.label}
								title={row.label}
								value={row.value}
								monospaced={row.kind === 'value'}
							/>
						)
					)}
				</M3Section>
			) : null}
		</ScrollView>
	);
}

function ImageDetailToolbar({
	model,
	attestations
}: {
	model: ImageDetailModel;
	attestations: ImageAttestationsModel;
}) {
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
	const items: AndroidToolbarItem[] = [];
	if (model.selectedSection === 'attestations' && attestations.predicateTypes.length > 1) {
		items.push({
			kind: 'menu',
			id: 'predicate',
			icon:
				attestations.selectedPredicateType === undefined
					? 'line.3.horizontal.decrease.circle'
					: 'line.3.horizontal.decrease.circle.fill',
			label: 'Filter by predicate type',
			items: [
				{
					id: 'all',
					title: 'All Types',
					checked: attestations.selectedPredicateType === undefined,
					onPress: () => attestations.setSelectedPredicateType(undefined)
				},
				...attestations.predicateTypes.map((type) => ({
					id: type,
					title: shortPredicateName(type),
					checked: attestations.selectedPredicateType === type,
					onPress: () => attestations.setSelectedPredicateType(type)
				}))
			]
		});
	}
	if (model.selectedSection === 'vulnerabilities' && canPatchImage(model.environmentID)) {
		items.push({
			kind: 'button',
			id: 'patch',
			icon: 'wrench.and.screwdriver',
			label: 'Patch image',
			onPress: () => security.openImagePatch(model.environmentID, model.image.id, model.displayName)
		});
	}
	if (model.exportedImage) {
		items.push({
			kind: 'button',
			id: 'share',
			icon: 'square.and.arrow.up',
			label: 'Share image archive',
			onPress: model.shareExport
		});
	}
	items.push(
		runningItemID === primary.id
			? { kind: 'spinner', id: primary.id, label: primary.title }
			: {
					kind: 'button',
					id: primary.id,
					icon: primary.systemImage,
					label: primary.title,
					color: primary.tint,
					disabled: disabled(primary),
					onPress: () => handle(primary)
				}
	);
	items.push({
		kind: 'menu',
		id: 'overflow',
		icon: 'ellipsis.circle',
		label: 'More actions',
		disabled: isDisabled,
		items: overflow.map((item) => ({
			id: item.id,
			title: item.title,
			destructive: item.role === 'destructive',
			disabled: disabled(item),
			onPress: () => handle(item)
		}))
	});
	return <AndroidToolbar items={items} />;
}

export function ImageDetailScreen() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const model = useImageDetail(envID, id);
	const nav = useImageNavigation();
	const attestations = useImageAttestations(envID, id, model.selectedSection === 'attestations');

	return (
		<>
			<Stack.Screen options={{ title: 'Image Details' }} />
			<ImageDetailToolbar model={model} attestations={attestations} />
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<ScrollableTabBar
					selection={model.selectedSection}
					onSelectionChange={model.setSelectedSection}
					options={imageDetailSections}
					accessibilityLabel="Image detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedSection === 'overview' ? <OverviewTab model={model} /> : null}
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
