/**
 * Android rendering of `RolesView` (RolesView.swift): Built-in and Custom
 * Material groups with search, pull-to-refresh and pagination; custom roles
 * offer Delete on long-press in place of the swipe action.
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Role } from '@/sdk/models/role/Role';
import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { CenteredMessage } from '../shared/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';
import { UnavailableView } from '@/ui/components/unavailable-view';

import { roleDisplayName, roleIconColor, roleSystemImage } from './rbac-models';
import { useRolesList, type RolesListModel } from './use-roles-list';

function RoleItem({ model, role }: { model: RolesListModel; role: Role }) {
	const meta =
		role.assignedUserCount > 0
			? `${role.permissions.length} permissions · ${role.assignedUserCount} assigned`
			: `${role.permissions.length} permissions`;
	return (
		<LongPressMenu
			title={roleDisplayName(role)}
			accessibilityLabel={roleDisplayName(role)}
			onPress={() => model.openRole(role)}
			items={
				role.builtIn
					? []
					: [
							{
								id: 'delete',
								title: 'Delete',
								destructive: true,
								onPress: () => model.requestDelete(role)
							}
						]
			}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 72,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<RowIcon systemImage={roleSystemImage(role)} tint={roleIconColor(role)} />
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{roleDisplayName(role)}</Text>
				{role.description ? (
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						{role.description}
					</Text>
				) : null}
				<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}>{meta}</Text>
			</View>
			{role.builtIn ? (
				<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>Built-in</Text>
			) : null}
			<Icon name="chevron.right" size={20} color={m3.onSurfaceVariant} />
		</LongPressMenu>
	);
}

function RoleGroup({ model, roles }: { model: RolesListModel; roles: Role[] }) {
	return (
		<MaterialListGroup>
			{roles.map((role, index) => (
				<View key={role.id}>
					{index > 0 ? (
						<View style={{ height: 0.5, marginLeft: 68, backgroundColor: colors.separator }} />
					) : null}
					<RoleItem model={model} role={role} />
				</View>
			))}
		</MaterialListGroup>
	);
}

export function RolesDestination() {
	const model = useRolesList();
	const [refreshing, setRefreshing] = useState(false);
	const { roles, builtIns, customs } = model;
	const count = { loadedCount: roles.length, totalCount: model.totalItems, hasMore: model.hasMore };

	let content;
	if (!model.rbacAvailable) {
		content = (
			<CenteredMessage
				icon="lock.slash"
				title="Roles Not Available"
				message="Role-based access control requires Arcane v2 or newer."
			/>
		);
	} else if (!model.canManageRoles) {
		content = (
			<CenteredMessage
				icon="lock.fill"
				title="Admin Required"
				message="You don't have permission to view roles."
			/>
		);
	} else if (model.isLoading && roles.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading roles…" />
			</View>
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
			<>
				{builtIns.length > 0 ? (
					<>
						<ResourceCountSectionHeader title="Built-in" {...count} />
						<RoleGroup model={model} roles={builtIns} />
					</>
				) : null}
				{customs.length > 0 ? (
					<>
						{builtIns.length === 0 ? (
							<ResourceCountSectionHeader title="Custom" {...count} />
						) : (
							<MaterialSectionHeader title="Custom" />
						)}
						<RoleGroup model={model} roles={customs} />
					</>
				) : null}
				<PaginatedListFooter
					hasMore={model.hasMore}
					loadMoreError={model.loadMoreError}
					onRetry={() => void model.loadMore()}
					onLoadMore={() => void model.loadMore()}
				/>
			</>
		);
	}

	const toolbarItems: AndroidToolbarItem[] = [];
	if (model.canAccessOIDCMappings) {
		toolbarItems.push({
			kind: 'button',
			id: 'oidc',
			icon: 'gearshape',
			label: 'Manage OIDC Role Mappings',
			onPress: model.openOIDCMappings
		});
	}
	if (model.rbacAvailable && model.canManageRoles) {
		toolbarItems.push({
			kind: 'button',
			id: 'create',
			icon: 'plus',
			label: 'Create Role',
			onPress: model.openCreate
		});
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Roles',
					headerSearchBarOptions: {
						placeholder: 'Search roles',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{toolbarItems.length > 0 ? <AndroidToolbar items={toolbarItems} /> : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						colors={[m3.primary as string]}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				{content}
			</ScrollView>
			<ActionErrorAlert
				title="Couldn't Delete Role"
				message={model.actionErrorMessage}
				onDismiss={model.dismissActionError}
			/>
		</>
	);
}
