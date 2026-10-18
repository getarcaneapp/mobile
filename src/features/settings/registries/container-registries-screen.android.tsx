import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ResourceCountLabel } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { MaterialListGroup } from '@/ui/material/list';
import type { ContainerRegistry } from '@/sdk/models/containerRegistry/ContainerRegistry';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { AndroidToolbar } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';
import { UnavailableView } from '@/ui/components/unavailable-view';

import {
	registryName,
	registryRowSubtitle,
	registryRowTitle,
	useContainerRegistries
} from './use-container-registries';
import { withCleanup } from '@/core/with-cleanup';

export function RegistryRow({ registry }: { registry: ContainerRegistry }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
			<RowIcon systemImage="shippingbox.fill" />
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]} numberOfLines={1}>
					{registryRowTitle(registry)}
				</Text>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]} numberOfLines={1}>
					{registryRowSubtitle(registry)}
				</Text>
			</View>
			{!registry.enabled ? (
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>Disabled</Text>
			) : null}
		</View>
	);
}

export function ContainerRegistriesScreen() {
	const model = useContainerRegistries();
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			async () => {
				await model.refresh();
			},
			() => setRefreshing(false)
		);
	};

	let content;
	if (!model.isAdmin) {
		content = (
			<UnavailableView
				title="Admin Required"
				systemImage="lock.fill"
				description="Only administrators can manage container registries."
			/>
		);
	} else if (model.isLoading && model.registries.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading registries..." />
			</View>
		);
	} else if (model.errorMessage !== undefined && model.registries.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Registries"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.loadRegistries() }]}
			/>
		);
	} else if (model.registries.length === 0) {
		content = (
			<UnavailableView
				title="No Container Registries"
				systemImage="shippingbox"
				description="Add a registry to pull private images and check for updates behind authentication."
				actions={[{ title: 'Add Registry', onPress: model.openCreate }]}
			/>
		);
	} else {
		content = (
			<View>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						paddingHorizontal: 16,
						paddingTop: 20,
						paddingBottom: 6
					}}
				>
					<Text
						accessibilityRole="header"
						style={[m3Type.titleSmall, { color: colors.secondaryLabel, flex: 1 }]}
					>
						Container Registries
					</Text>
					<ResourceCountLabel
						loadedCount={model.registries.length}
						totalCount={model.totalItems}
						hasMore={model.hasMore}
					/>
				</View>
				<MaterialListGroup>
					{model.registries.map((registry) => (
						<LongPressMenu
							key={registry.id}
							title={registryName(registry)}
							onPress={() => model.openEdit(registry)}
							items={[
								{ id: 'edit', title: 'Edit', onPress: () => model.openEdit(registry) },
								{
									id: 'delete',
									title: 'Delete',
									destructive: true,
									onPress: () => model.setPendingDeleteRegistry(registry)
								}
							]}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								minHeight: 72,
								paddingHorizontal: 16,
								paddingVertical: 10
							}}
						>
							<RegistryRow registry={registry} />
						</LongPressMenu>
					))}
					<PaginatedListFooter
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				</MaterialListGroup>
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Container Registries',
					headerSearchBarOptions: {
						placeholder: 'Search registries',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{model.isAdmin ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'add',
							icon: 'plus',
							label: 'Add Registry',
							onPress: model.openCreate
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
			<ActionErrorAlert
				title="Couldn't Delete Registry"
				message={model.actionErrorMessage}
				onDismiss={model.dismissActionError}
			/>
		</>
	);
}
