import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import type { SwarmStackSummary } from '@/sdk/models/swarm/SwarmStack';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	CenteredMessage,
	M3Section,
	SwitchRow,
	TextButtonRow
} from '@/features/containers/android-material';
import {
	AndroidResourceActionsToolbar,
	AndroidToolbar
} from '@/features/containers/android-toolbar';
import { LongPressMenu, type RowMenuItem } from '@/features/containers/long-press-menu';
import { ActionItem, LinkItem, SectionTitle, SheetError } from '@/features/networks/android-parts';

import { swarmDate } from './swarm-common';
import { SwarmListState } from './swarm-parts';
import { EmbeddedSwarmServices } from './swarm-services-view';
import { SwarmTasksList } from './swarm-tasks-view';
import {
	resolveImageOptions,
	stackEditorConfirmationHost,
	useSwarmStackDetail,
	useSwarmStackEditor,
	useSwarmStacks,
	validationSummary,
	type SwarmStackDetailModel,
	type SwarmStacksModel
} from './use-swarm-stacks';

const stackRowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const stackBodyStyle = { flex: 1, gap: 3 };
const listContentStyle = { paddingBottom: 32 };
const noMenuItems: RowMenuItem[] = [];

function StackRow({ model, stack }: { model: SwarmStacksModel; stack: SwarmStackSummary }) {
	return (
		<LongPressMenu
			title={stack.name}
			items={
				model.canManage
					? [
							{
								id: 'delete',
								title: 'Delete',
								destructive: true,
								onPress: () => model.requestDelete(stack)
							}
						]
					: noMenuItems
			}
			onPress={() => model.openDetail(stack)}
			style={stackRowStyle}
		>
			<RowIcon systemImage="square.stack.3d.up.fill" />
			<View style={stackBodyStyle}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{stack.name}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{model.servicesText(stack)}
				</Text>
			</View>
			<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}>
				{swarmDate(stack.updatedAt)}
			</Text>
		</LongPressMenu>
	);
}

export function SwarmStacksScreen() {
	const { envID = '0' } = useLocalSearchParams<{ envID?: string }>();
	const model = useSwarmStacks(envID);
	const { snapshot, items } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Stacks',
					headerSearchBarOptions: {
						placeholder: 'Search stacks',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{model.canManage ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'deploy',
							icon: 'plus',
							label: 'Deploy Stack',
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
				emptySystemImage="square.stack.3d.up"
				retry={() => void model.load()}
			>
				<GroupedFlashList
					data={items.map((item, index) => ({
						key: String(item.id),
						type: 'item',
						stack: item.value,
						grouped: groupPosition(index, items.length)
					}))}
					renderEntry={(entry) => <StackRow model={model} stack={entry.stack} />}
					header={
						<SectionTitle
							title="Stacks"
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

function SourceView({ model }: { model: SwarmStackDetailModel }) {
	const { loadSource } = model;
	useEffect(() => {
		void loadSource();
	}, [loadSource]);
	if (model.source) {
		return (
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section title="compose.yaml">
					<Text
						selectable
						style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label, padding: 16 }}
					>
						{model.source.composeContent}
					</Text>
				</M3Section>
				{model.source.envContent ? (
					<M3Section title=".env">
						<Text
							selectable
							style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label, padding: 16 }}
						>
							{model.source.envContent}
						</Text>
					</M3Section>
				) : null}
			</ScrollView>
		);
	}
	if (model.sourceError !== undefined) {
		return (
			<CenteredMessage
				icon="doc.text"
				title="Source Unavailable"
				message={model.sourceError}
				action={{ title: 'Try Again', onPress: () => void model.loadSource() }}
			/>
		);
	}
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
			<ArcaneLoadingView label="Loading…" />
		</View>
	);
}

export function SwarmStackDetailScreen() {
	const model = useSwarmStackDetail();
	return (
		<>
			<Stack.Screen options={{ title: model.name }} />
			{model.canManage ? (
				<AndroidResourceActionsToolbar
					primary={model.toolbar.primary}
					overflow={model.toolbar.overflow}
					runningItemID={model.toolbar.runningItemID}
					isDisabled={model.toolbar.isDisabled}
					resourceName={model.name}
				/>
			) : null}
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<ScrollableTabBar
					selection={model.selectedTab}
					onSelectionChange={model.setSelectedTab}
					options={model.tabs}
					accessibilityLabel="Stack detail sections"
				/>
				<View style={{ flex: 1 }}>
					{model.selectedTab === 'services' ? (
						<EmbeddedSwarmServices environmentID={model.environmentID} stackName={model.name} />
					) : null}
					{model.selectedTab === 'tasks' ? (
						<SwarmTasksList
							environmentID={model.environmentID}
							source={{ kind: 'stack', name: model.name }}
						/>
					) : null}
					{model.selectedTab === 'source' ? <SourceView model={model} /> : null}
				</View>
			</View>
		</>
	);
}

export function SwarmStackEditorScreen() {
	const model = useSwarmStackEditor();
	const [editingFile, setEditingFile] = useState<'compose' | 'env'>();
	const validation = model.validation;

	if (editingFile) {
		const isEnvironment = editingFile === 'env';
		return (
			<>
				<Stack.Screen
					options={{ title: isEnvironment ? '.env' : 'compose.yaml', gestureEnabled: false }}
				/>
				<AndroidToolbar
					placement="left"
					items={[
						{
							kind: 'button',
							id: 'back',
							icon: 'chevron.left',
							label: 'Back',
							onPress: () => setEditingFile(undefined)
						}
					]}
				/>
				<AndroidToolbar items={[]} />
				<ScrollView
					style={{ backgroundColor: colors.systemBackground }}
					contentContainerStyle={{ flexGrow: 1 }}
					keyboardShouldPersistTaps="handled"
				>
					<TextInput
						value={isEnvironment ? model.environment : model.compose}
						onChangeText={isEnvironment ? model.setEnvironment : model.setCompose}
						editable={!model.isSaving}
						multiline
						autoCapitalize="none"
						autoCorrect={false}
						placeholder={isEnvironment ? 'KEY=value' : 'services:'}
						placeholderTextColor={colors.secondaryLabel}
						style={{
							flex: 1,
							padding: 16,
							fontFamily: monoFamily,
							fontSize: 13,
							color: colors.label,
							textAlignVertical: 'top'
						}}
					/>
				</ScrollView>
			</>
		);
	}

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
					{
						kind: 'button',
						id: 'save',
						icon: 'checkmark',
						label: model.saveTitle,
						disabled: !model.canSave || model.isSaving,
						onPress: model.save
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<View
					pointerEvents={model.isSaving ? 'none' : 'auto'}
					style={{ opacity: model.isSaving ? 0.6 : 1 }}
				>
					{model.isLoaded ? (
						<>
							{!model.isEditing ? (
								<M3Section title="Stack">
									<FormTextField
										title="Name"
										placeholder="my-stack"
										text={model.name}
										onChangeText={model.setName}
										autocapitalization="never"
										autocorrectionDisabled
									/>
								</M3Section>
							) : null}
							<M3Section title="Files">
								<LinkItem
									title="Compose file"
									icon="doc.text"
									onPress={() => setEditingFile('compose')}
								/>
								<LinkItem
									title="Environment variables"
									icon="list.bullet.rectangle"
									onPress={() => setEditingFile('env')}
								/>
								<ActionItem
									title="Validate"
									icon="checkmark.seal"
									onPress={model.validate}
									disabled={model.isValidating || model.compose === ''}
									trailing={model.isValidating ? <ActivityIndicator size="small" /> : undefined}
								/>
							</M3Section>
							{validation ? (
								<M3Section title="Validation">
									<View
										style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
									>
										<Icon name="checkmark.circle.fill" size={20} color={systemColors.green} />
										<Text style={[m3Type.bodyMedium, { color: systemColors.green, flex: 1 }]}>
											{validationSummary(validation)}
										</Text>
									</View>
									{(validation.warnings ?? []).map((warning) => (
										<View
											key={warning}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												gap: 12,
												paddingHorizontal: 16,
												paddingBottom: 12
											}}
										>
											<Icon name="exclamationmark.triangle" size={18} color={systemColors.orange} />
											<Text style={[m3Type.bodyMedium, { color: systemColors.orange, flex: 1 }]}>
												{warning}
											</Text>
										</View>
									))}
								</M3Section>
							) : null}
							<M3Section title="Deploy">
								{model.isEditing ? (
									<SwitchRow
										title="Redeploy After Saving"
										value={model.redeploy}
										onValueChange={model.setRedeploy}
									/>
								) : null}
								{model.showsDeployOptions ? (
									<>
										<SwitchRow
											title="Prune Removed Services"
											value={model.prune}
											onValueChange={model.setPrune}
										/>
										<SwitchRow
											title="Send Registry Auth"
											value={model.withRegistryAuth}
											onValueChange={model.setWithRegistryAuth}
										/>
										<FormPicker
											title="Resolve Image"
											selection={model.resolveImage}
											onSelectionChange={model.setResolveImage}
											options={resolveImageOptions}
										/>
									</>
								) : null}
							</M3Section>
						</>
					) : model.errorMessage === undefined ? (
						<View style={{ padding: 24, alignItems: 'center' }}>
							<ArcaneLoadingView label="Loading stack…" />
						</View>
					) : null}
					<SheetError message={model.errorMessage} />
					{model.errorMessage && !model.isLoaded ? (
						<M3Section>
							<TextButtonRow title="Try Again" onPress={model.load} />
						</M3Section>
					) : null}
				</View>
			</ScrollView>
			<DeleteConfirmationHost hostID={stackEditorConfirmationHost} />
		</>
	);
}
