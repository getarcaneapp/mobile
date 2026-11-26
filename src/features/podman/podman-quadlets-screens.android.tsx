import { AdvancedGate } from '@/features/navigation/advanced-gate';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { PodmanContainer, QuadletDetail } from '@/sdk/models/podman/Quadlet';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormTextField } from '@/ui/components/form-fields';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';

import { CenteredMessage, M3Section, ValueRow } from '@/features/containers/android-material';
import {
	AndroidResourceActionsToolbar,
	AndroidToolbar
} from '@/features/containers/android-toolbar';
import { LongPressMenu } from '@/features/containers/long-press-menu';
import { SectionTitle, SheetError } from '@/features/networks/android-parts';
import { SwarmListState } from '@/features/swarm/swarm-parts';

import { podmanStateVariant } from './podman-logic';
import { PodmanStateBadge } from './podman-state-badge';
import {
	quadletSubtitle,
	usePodmanQuadletDetail,
	usePodmanQuadletEditor,
	usePodmanQuadlets,
	type PodmanQuadletsModel,
	type QuadletRow as QuadletRowValue
} from './use-podman-quadlets';

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const bodyStyle = { flex: 1, gap: 3 };
const listContentStyle = { paddingBottom: 32 };

function QuadletRow({ model, quadlet }: { model: PodmanQuadletsModel; quadlet: QuadletRowValue }) {
	const state = QuadletDetail.state(quadlet);
	return (
		<LongPressMenu
			title={quadlet.name}
			items={model.menuActions(quadlet)}
			onPress={() => model.openDetail(quadlet)}
			style={rowStyle}
		>
			<RowIcon
				systemImage="doc.badge.gearshape"
				tint={podmanStateVariant(state) === 'stopped' ? systemColors.gray : undefined}
			/>
			<View style={bodyStyle}>
				<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
					{quadlet.name}
				</Text>
				<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{quadletSubtitle(quadlet)}
				</Text>
			</View>
			<PodmanStateBadge key={quadlet.name} state={state} />
		</LongPressMenu>
	);
}

export function PodmanQuadletsScreen() {
	const model = usePodmanQuadlets();
	const { snapshot, items } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Quadlets',
					headerSearchBarOptions: {
						placeholder: 'Search quadlets',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{model.canCreate ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'create',
							icon: 'plus',
							label: 'Install Quadlet',
							onPress: model.openCreate
						}
					]}
				/>
			) : null}
			<SwarmListState
				isLoading={snapshot.isLoading}
				isEmpty={items.length === 0}
				errorMessage={snapshot.errorMessage}
				emptyTitle={model.emptyTitle}
				emptySystemImage="doc.badge.gearshape"
				retry={() => void model.load()}
			>
				<GroupedFlashList
					data={items.map((item, index) => ({
						key: String(item.id),
						type: 'item',
						quadlet: item.value,
						grouped: groupPosition(index, items.length)
					}))}
					renderEntry={(entry) => <QuadletRow model={model} quadlet={entry.quadlet} />}
					header={
						<SectionTitle
							title="Quadlets"
							trailing={
								<ResourceCountLabel
									loadedCount={items.length}
									totalCount={snapshot.totalItems}
									hasMore={snapshot.hasMore}
								/>
							}
						/>
					}
					footer={
						<PaginatedListFooter
							hasMore={snapshot.hasMore}
							loadMoreError={snapshot.loadMoreError}
							onRetry={() => void model.loadMore()}
							onLoadMore={() => void model.loadMore()}
						/>
					}
					onEndReached={
						snapshot.hasMore && snapshot.loadMoreError === undefined
							? () => void model.loadMore()
							: undefined
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								void model.load().finally(() => setRefreshing(false));
							}}
						/>
					}
					contentContainerStyle={listContentStyle}
				/>
			</SwarmListState>
		</>
	);
}

export function PodmanQuadletDetailScreen() {
	const model = usePodmanQuadletDetail();
	const { detail } = model;
	const [refreshing, setRefreshing] = useState(false);
	let content;
	if (detail) {
		content = (
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				<M3Section title="Details">
					<View style={[rowStyle, { minHeight: 48 }]}>
						<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>State</Text>
						<PodmanStateBadge state={model.state} />
					</View>
					{model.details.map((row) => (
						<ValueRow
							key={row.title}
							title={row.title}
							value={row.value}
							monospaced={row.monospaced}
						/>
					))}
				</M3Section>
				{model.unitDetails.length > 0 ? (
					<M3Section title="systemd Unit">
						{model.unitDetails.map((row) => (
							<ValueRow key={row.title} title={row.title} value={row.value} />
						))}
					</M3Section>
				) : null}
				{model.containers.length > 0 ? (
					<M3Section title="Containers">
						{model.containers.map((container) => (
							<View key={container.id} style={rowStyle}>
								<RowIcon systemImage="cube.box.fill" />
								<View style={bodyStyle}>
									<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
										{PodmanContainer.displayName(container)}
									</Text>
									<Text
										numberOfLines={1}
										style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
									>
										{container.image}
									</Text>
								</View>
								<PodmanStateBadge state={container.state} />
							</View>
						))}
					</M3Section>
				) : null}
				{model.content !== undefined ? (
					<M3Section title="File">
						<Text
							selectable
							style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label, padding: 16 }}
						>
							{model.content}
						</Text>
					</M3Section>
				) : null}
			</ScrollView>
		);
	} else if (model.errorMessage !== undefined) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Quadlet"
				message={model.errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.load() }}
			/>
		);
	} else {
		content = (
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.systemGroupedBackground
				}}
			>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	}
	return (
		<>
			<Stack.Screen options={{ title: model.name }} />
			<AndroidResourceActionsToolbar
				primary={model.toolbar.primary}
				secondary={model.toolbar.secondary}
				overflow={model.toolbar.overflow}
				runningItemID={model.toolbar.runningItemID}
				isDisabled={model.toolbar.isDisabled}
				resourceName={model.name}
			/>
			{content}
		</>
	);
}

function PodmanQuadletEditorScreenContent() {
	const model = usePodmanQuadletEditor();
	return (
		<>
			<Stack.Screen
				options={{ title: model.title, gestureEnabled: !(model.hasChanges || model.isSaving) }}
			/>
			<AndroidToolbar
				placement="left"
				items={[
					{
						kind: 'button',
						id: 'cancel',
						icon: 'xmark',
						label: 'Cancel',
						disabled: model.isSaving,
						onPress: model.cancel
					}
				]}
			/>
			<AndroidToolbar
				items={[
					model.isSaving
						? { kind: 'spinner', id: 'save', label: model.saveTitle }
						: {
								kind: 'button',
								id: 'save',
								icon: 'checkmark',
								label: model.saveTitle,
								disabled: !model.canSave,
								onPress: model.save
							}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				{!model.isEditing ? (
					<M3Section footer={model.nameError}>
						<FormTextField
							title="File Name"
							placeholder="web.container"
							text={model.name}
							onChangeText={model.setName}
							autocapitalization="never"
							autocorrectionDisabled
						/>
					</M3Section>
				) : null}
				<M3Section title="Contents">
					<TextInput
						value={model.content}
						onChangeText={model.setContent}
						editable={!model.isSaving}
						multiline
						autoCapitalize="none"
						autoCorrect={false}
						accessibilityLabel="Contents"
						placeholder="[Container]"
						placeholderTextColor={colors.secondaryLabel}
						style={{
							minHeight: 320,
							margin: 16,
							padding: 12,
							borderWidth: 1,
							borderColor: m3.outline,
							borderRadius: 4,
							fontFamily: monoFamily,
							fontSize: 13,
							color: colors.label,
							textAlignVertical: 'top'
						}}
					/>
				</M3Section>
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}

export function PodmanQuadletEditorScreen() {
	return (
		<AdvancedGate>
			<PodmanQuadletEditorScreenContent />
		</AdvancedGate>
	);
}
