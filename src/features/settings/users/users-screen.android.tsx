import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { User } from '@/sdk/models/user/User';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { GroupedFlashList, groupPosition } from '@/ui/components/grouped-flash-list';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { AndroidToolbar } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';
import { UnavailableView } from '@/ui/components/unavailable-view';

import { displayUsername, useUsersList, type UsersListModel } from './use-users-list';

export function UserRow({ user }: { user: User }) {
	const isAdmin = User.isAdmin(user);
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 }}>
			<RowIcon systemImage="person.fill" tint={isAdmin ? systemColors.indigo : systemColors.blue} />
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]} numberOfLines={1}>
					{displayUsername(user)}
				</Text>
				{user.email !== undefined ? (
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]} numberOfLines={1}>
						{user.email}
					</Text>
				) : null}
			</View>
			{isAdmin ? (
				<Text style={[m3Type.labelLarge, { color: systemColors.indigo }]}>Admin</Text>
			) : null}
		</View>
	);
}

function UserItem({ model, user }: { model: UsersListModel; user: User }) {
	return (
		<LongPressMenu
			title={user.username}
			onPress={() => model.openUser(user)}
			accessibilityLabel={displayUsername(user)}
			items={[
				{
					id: 'delete',
					title: 'Delete',
					destructive: true,
					onPress: () => model.requestDelete(user)
				}
			]}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				minHeight: 72,
				paddingHorizontal: 16,
				paddingVertical: 8
			}}
		>
			<UserRow user={user} />
			<Icon name="chevron.right" size={20} color={m3.onSurfaceVariant} />
		</LongPressMenu>
	);
}

export function UsersDestination() {
	const model = useUsersList();
	const [refreshing, setRefreshing] = useState(false);
	const { users } = model;

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			colors={[m3.primary as string]}
			onRefresh={() => {
				setRefreshing(true);
				void model.load().finally(() => setRefreshing(false));
			}}
		/>
	);

	let content;
	if (model.isLoading && users.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading users..." />
			</View>
		);
	} else if (model.errorMessage !== undefined && users.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Users"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.load() }]}
			/>
		);
	} else if (users.length === 0) {
		content = (
			<UnavailableView
				title="No Users"
				systemImage="person.slash"
				description="Add a user to give someone else access to this Arcane server."
				actions={[{ title: 'Add User', onPress: model.openCreate }]}
			/>
		);
	} else {
		content = (
			<GroupedFlashList
				data={users.map((user, index) => ({
					key: user.id,
					type: 'user',
					user,
					grouped: groupPosition(index, users.length)
				}))}
				renderEntry={(entry) => (
					<>
						{entry.grouped.isFirst ? null : (
							<View style={{ height: 0.5, marginLeft: 68, backgroundColor: colors.separator }} />
						)}
						<UserItem model={model} user={entry.user} />
					</>
				)}
				header={
					<ResourceCountSectionHeader
						title="Users"
						loadedCount={users.length}
						totalCount={model.totalItems}
						hasMore={model.hasMore}
					/>
				}
				footer={
					<PaginatedListFooter
						hasMore={model.hasMore}
						loadMoreError={model.loadMoreError}
						onRetry={() => void model.loadMore()}
						onLoadMore={() => void model.loadMore()}
					/>
				}
				onEndReached={
					model.hasMore && model.loadMoreError === undefined
						? () => void model.loadMore()
						: undefined
				}
				refreshControl={refreshControl}
				contentContainerStyle={{ paddingBottom: 32 }}
			/>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Users',
					headerSearchBarOptions: {
						placeholder: 'Search users',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'settings',
						icon: 'gearshape',
						label: 'User Settings',
						onPress: model.openSettings
					},
					{ kind: 'button', id: 'add', icon: 'plus', label: 'Add User', onPress: model.openCreate }
				]}
			/>
			{users.length > 0 ? (
				content
			) : (
				<ScrollView
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
					keyboardShouldPersistTaps="handled"
					refreshControl={refreshControl}
				>
					{content}
				</ScrollView>
			)}
			<ActionErrorAlert
				title="Couldn't Delete User"
				message={model.actionErrorMessage}
				onDismiss={model.dismissActionError}
			/>
		</>
	);
}
