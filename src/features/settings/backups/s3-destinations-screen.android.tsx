/** Android rendering of `S3DestinationsView` (S3DestinationsView.swift). */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { useItemDeleteConfirmation } from '@/ui/components/delete-confirmation';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { AndroidToolbar } from '../shared/android-toolbar';
import { CenteredMessage } from '../shared/android-material';
import { LongPressMenu } from '../shared/long-press-menu';
import { AndroidErrorRetry } from './backup-android';
import { useS3Destinations } from './use-s3-destinations';

export function S3DestinationsScreen() {
	const model = useS3Destinations();
	const [refreshing, setRefreshing] = useState(false);
	const { destinations, busy, errorMessage } = model;
	useItemDeleteConfirmation(model.deleteTarget, model.setDeleteTarget, (destination) => ({
		title: 'Delete S3 destination?',
		message: 'Destinations referenced by backups or policies cannot be deleted.',
		actions: [{ title: 'Delete', action: () => model.remove(destination) }],
		dismissOnConfirm: false
	}));

	return (
		<>
			<Stack.Screen options={{ title: 'S3 Destinations' }} />
			{model.canCreate ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'add',
							icon: 'plus',
							label: 'Add S3 Destination',
							onPress: model.openCreate
						}
					]}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
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
				{busy && destinations.length === 0 ? (
					<View style={{ padding: 24, alignItems: 'center' }}>
						<ArcaneLoadingView label="Loading…" />
					</View>
				) : null}
				<AndroidErrorRetry message={errorMessage} onRetry={() => void model.load()} />
				{destinations.length > 0 || model.hasMore ? (
					<MaterialListGroup>
						{destinations.map((destination) => (
							<LongPressMenu
								key={destination.id}
								title={destination.name}
								accessibilityLabel={destination.name}
								onPress={() => model.openEditor(destination)}
								items={
									model.canDelete
										? [
												{
													id: 'delete',
													title: 'Delete',
													destructive: true,
													onPress: () => model.setDeleteTarget(destination)
												}
											]
										: []
								}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 16,
									minHeight: 72,
									paddingHorizontal: 16,
									paddingVertical: 8
								}}
							>
								<Icon
									name="externaldrive.connected.to.line.below"
									size={24}
									color={colors.secondaryLabel}
								/>
								<View style={{ flex: 1, gap: 2 }}>
									<Text style={[m3Type.bodyLarge, { color: colors.label }]} numberOfLines={1}>
										{destination.name}
									</Text>
									<Text
										style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}
										numberOfLines={1}
									>
										{destination.bucket}
									</Text>
									<Text
										style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
										numberOfLines={1}
									>
										{destination.region}
									</Text>
								</View>
								<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
							</LongPressMenu>
						))}
						<PaginatedListFooter
							key={destinations.length}
							hasMore={model.hasMore}
							loadMoreError={model.loadMoreError}
							onRetry={model.loadMore}
							onLoadMore={model.loadMore}
						/>
					</MaterialListGroup>
				) : null}
				{destinations.length === 0 && !busy && errorMessage === undefined ? (
					<CenteredMessage
						icon="externaldrive.connected.to.line.below"
						title="No S3 Destinations"
						message=""
					/>
				) : null}
			</ScrollView>
		</>
	);
}
