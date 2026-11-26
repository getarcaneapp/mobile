import { AdvancedGate } from '@/features/navigation/advanced-gate';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { PodmanSecret } from '@/sdk/models/podman/PodmanSecret';
import { colors } from '@/theme/colors';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { LongPressMenu } from '@/features/containers/long-press-menu';
import { SectionTitle, SheetError } from '@/features/networks/android-parts';
import { SwarmListState } from '@/features/swarm/swarm-parts';

import {
	usePodmanSecretForm,
	usePodmanSecrets,
	type PodmanSecretsModel
} from './use-podman-secrets';

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	paddingHorizontal: 16,
	paddingVertical: 10
};
const listContentStyle = { paddingBottom: 32 };

function SecretRow({ model, secret }: { model: PodmanSecretsModel; secret: PodmanSecret }) {
	const actions = model.menuActions(secret);
	return (
		<LongPressMenu title={secret.name} items={actions} style={rowStyle}>
			<RowIcon systemImage="key.fill" />
			<View style={{ flex: 1, gap: 3 }}>
				<Text numberOfLines={1} style={[m3Type.bodyLarge, { color: colors.label }]}>
					{secret.name}
				</Text>
				<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{model.subtitle(secret)}
				</Text>
			</View>
		</LongPressMenu>
	);
}

export function PodmanSecretsScreen() {
	const model = usePodmanSecrets();
	const { snapshot, items } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Secrets',
					headerSearchBarOptions: {
						placeholder: 'Search secrets',
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
							label: 'Create Secret',
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
				emptySystemImage="key"
				retry={() => void model.load()}
			>
				<GroupedFlashList
					data={items.map((item, index) => ({
						key: String(item.id),
						type: 'item',
						secret: item.value,
						grouped: groupPosition(index, items.length)
					}))}
					renderEntry={(entry) => <SecretRow model={model} secret={entry.secret} />}
					header={
						<SectionTitle
							title="Secrets"
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

function PodmanSecretFormScreenContent() {
	const model = usePodmanSecretForm();
	return (
		<>
			<Stack.Screen options={{ title: model.title, gestureEnabled: !model.dismissDisabled }} />
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
				{!model.isReplacing ? (
					<M3Section>
						<FormTextField
							title="Name"
							placeholder="db_password"
							text={model.name}
							onChangeText={model.setName}
							autocapitalization="never"
							autocorrectionDisabled
						/>
					</M3Section>
				) : null}
				<M3Section footer={model.footer}>
					<FormSecureField
						title="Value"
						placeholder="Required"
						text={model.data}
						onChangeText={model.setData}
					/>
					<FormTextField
						title="Driver"
						placeholder="file"
						text={model.driver}
						onChangeText={model.setDriver}
						autocapitalization="never"
						autocorrectionDisabled
					/>
				</M3Section>
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}

export function PodmanSecretFormScreen() {
	return (
		<AdvancedGate>
			<PodmanSecretFormScreenContent />
		</AdvancedGate>
	);
}
