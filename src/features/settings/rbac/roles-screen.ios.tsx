/** Port of `RolesView` + `RoleRow` (RolesView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	List,
	Section,
	Spacer,
	SwipeActions,
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
	refreshable,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import type { Role } from '@/sdk/models/role/Role';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { DisclosureChevron } from '@/ui/settings-row';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { UnavailableView } from '@/ui/components/unavailable-view';

import { roleDisplayName, roleIconColor, roleSystemImage } from './rbac-models';
import { useRolesList, type RolesListModel } from './use-roles-list';

const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;

function RoleRow({ role }: { role: Role }) {
	return (
		<HStack spacing={12}>
			<RowIcon systemImage={roleSystemImage(role)} tint={roleIconColor(role)} />
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'body' })]}>{roleDisplayName(role)}</Text>
				{role.description ? (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{role.description}
					</Text>
				) : null}
				<HStack spacing={6}>
					<Text
						modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(tertiary)]}
					>{`${role.permissions.length} permissions`}</Text>
					{role.assignedUserCount > 0 ? (
						<>
							<Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(tertiary)]}>
								·
							</Text>
							<Text
								modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(tertiary)]}
							>{`${role.assignedUserCount} assigned`}</Text>
						</>
					) : null}
				</HStack>
			</VStack>
			<Spacer />
			{role.builtIn ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption2', weight: 'semibold' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					Built-in
				</Text>
			) : null}
		</HStack>
	);
}

function RoleLink({ model, role }: { model: RolesListModel; role: Role }) {
	return (
		<Button onPress={() => model.openRole(role)} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<RoleRow role={role} />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

export function RolesDestination() {
	const model = useRolesList();
	const accent = useAccentColor();
	const { roles, builtIns, customs } = model;
	const count = { loadedCount: roles.length, totalCount: model.totalItems, hasMore: model.hasMore };

	let content;
	if (!model.rbacAvailable) {
		content = (
			<ContentUnavailableView
				title="Roles Not Available"
				systemImage="lock.slash"
				description="Role-based access control requires Arcane v2 or newer."
			/>
		);
	} else if (!model.canManageRoles) {
		content = (
			<ContentUnavailableView
				title="Admin Required"
				systemImage="lock.fill"
				description="You don't have permission to view roles."
			/>
		);
	} else if (model.isLoading && roles.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading roles…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && roles.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Roles"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.load() }]}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				{builtIns.length > 0 ? (
					<Section header={<ResourceCountSectionHeader title="Built-in" {...count} />}>
						{builtIns.map((role) => (
							<RoleLink key={role.id} model={model} role={role} />
						))}
					</Section>
				) : null}
				{customs.length > 0 ? (
					<Section
						header={
							builtIns.length === 0 ? (
								<ResourceCountSectionHeader title="Custom" {...count} />
							) : (
								<Text>Custom</Text>
							)
						}
					>
						{customs.map((role) => (
							<SwipeActions key={role.id}>
								<RoleLink model={model} role={role} />
								<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
									<Button
										label="Delete"
										systemImage="trash"
										onPress={() => model.requestDelete(role)}
										modifiers={[tint(systemColors.red)]}
									/>
								</SwipeActions.Actions>
							</SwipeActions>
						))}
					</Section>
				) : null}
				<PaginatedListFooter
					hasMore={model.hasMore}
					loadMoreError={model.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</List>
		);
	}

	const canCreate = model.rbacAvailable && model.canManageRoles;
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Roles',
					headerSearchBarOptions: {
						placeholder: 'Search roles',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			{model.canAccessOIDCMappings || canCreate ? (
				<AppToolbar placement="right" tintColor={accent}>
					{model.canAccessOIDCMappings ? (
						<Stack.Toolbar.Button
							icon="gearshape"
							accessibilityLabel="Manage OIDC Role Mappings"
							onPress={model.openOIDCMappings}
						/>
					) : null}
					{canCreate ? (
						<Stack.Toolbar.Button
							icon="plus"
							separateBackground
							accessibilityLabel="Create Role"
							onPress={model.openCreate}
						/>
					) : null}
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				{content}
				<ActionErrorAlert
					title="Couldn't Delete Role"
					message={model.actionErrorMessage}
					onDismiss={model.dismissActionError}
				/>
			</Host>
		</>
	);
}
