import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	HStack,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	refreshable,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import { User } from '@/sdk/models/user/User';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { DisclosureChevron } from '@/ui/settings-row';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { UnavailableView } from '@/ui/components/unavailable-view';

import { displayUsername, useUsersList, type UsersListModel } from './use-users-list';

export function UserRow({ user }: { user: User }) {
	const isAdmin = User.isAdmin(user);
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RowIcon systemImage="person.fill" tint={isAdmin ? systemColors.indigo : systemColors.blue} />
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'body' })]}>{displayUsername(user)}</Text>
				{user.email !== undefined ? (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{user.email}
					</Text>
				) : null}
			</VStack>
			<Spacer />
			{isAdmin ? (
				<Text
					modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(systemColors.indigo)]}
				>
					Admin
				</Text>
			) : null}
		</HStack>
	);
}

function UserLink({ model, user }: { model: UsersListModel; user: User }) {
	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<Button onPress={() => model.openUser(user)} modifiers={[buttonStyle('plain')]}>
					<HStack modifiers={[contentShape(shapes.rectangle())]}>
						<UserRow user={user} />
						<DisclosureChevron />
					</HStack>
				</Button>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<Button
					role="destructive"
					onPress={() => model.requestDelete(user)}
					modifiers={[tint(systemColors.red)]}
				>
					<DestructiveLabel text="Delete" />
				</Button>
			</ContextMenu.Items>
		</ContextMenu>
	);
}

export function UsersDestination() {
	const model = useUsersList();
	const accent = useAccentColor();
	const { users } = model;

	let content;
	if (model.isLoading && users.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading users..." />
			</VStack>
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
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				<Section
					header={
						<ResourceCountSectionHeader
							title="Users"
							loadedCount={users.length}
							totalCount={model.totalItems}
							hasMore={model.hasMore}
						/>
					}
				>
					{users.map((user) => (
						<UserLink key={user.id} model={model} user={user} />
					))}
				</Section>
				<PaginatedListFooter
					hasMore={model.hasMore}
					loadMoreError={model.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Users',
					headerSearchBarOptions: {
						placeholder: 'Search users',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<AppToolbar placement="right" tintColor={accent}>
				<Stack.Toolbar.Button
					icon="gearshape"
					accessibilityLabel="User Settings"
					onPress={model.openSettings}
				/>
				<Stack.Toolbar.Button
					icon="plus"
					separateBackground
					accessibilityLabel="Add User"
					onPress={model.openCreate}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>
				{content}
				<ActionErrorAlert
					title="Couldn't Delete User"
					message={model.actionErrorMessage}
					onDismiss={model.dismissActionError}
				/>
			</Host>
		</>
	);
}
