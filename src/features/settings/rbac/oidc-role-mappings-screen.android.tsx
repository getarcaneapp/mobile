/**
 * Android rendering of `OIDCRoleMappingsView` (OIDCRoleMappingsView.swift):
 * Material 3 list; tapping a manual mapping edits it and long-press offers
 * Delete in place of the swipe action.
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { OidcRoleMapping, OidcRoleMappingSource } from '@/sdk/models/role/OidcRoleMapping';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { CenteredMessage } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';

import { displayScopeLabel, roleDisplayName, roleIconColor, roleSystemImage } from './rbac-models';
import {
	isManualMapping,
	useOIDCRoleMappings,
	type OIDCRoleMappingsModel
} from './use-oidc-role-mappings';

function MappingItem({
	model,
	mapping
}: {
	model: OIDCRoleMappingsModel;
	mapping: OidcRoleMapping;
}) {
	const role = model.roleFor(mapping);
	const roleName = role ? roleDisplayName(role) : mapping.roleId;
	const manual = isManualMapping(mapping);
	return (
		<LongPressMenu
			title={mapping.claimValue}
			accessibilityLabel={`${mapping.claimValue} to ${roleName}`}
			onPress={manual ? () => model.openEdit(mapping) : undefined}
			items={
				manual
					? [
							{
								id: 'delete',
								title: 'Delete',
								destructive: true,
								onPress: () => model.requestDelete(mapping)
							}
						]
					: []
			}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 64,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<RowIcon
				systemImage={role ? roleSystemImage(role) : 'person.badge.key'}
				tint={role ? roleIconColor(role) : systemColors.indigo}
				size={30}
			/>
			<View style={{ flex: 1, gap: 2 }}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
					<Text style={[m3Type.bodyLarge, { color: colors.label, fontFamily: monoFamily }]}>
						{mapping.claimValue}
					</Text>
					<Icon name="arrow.right" size={14} color={colors.tertiaryLabel} />
					<Text style={[m3Type.bodyLarge, { color: colors.label, fontWeight: '600' }]}>
						{roleName}
					</Text>
				</View>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{displayScopeLabel(mapping.environmentId, model.availableEnvironments)}
				</Text>
			</View>
			{OidcRoleMapping.sourceKind(mapping) === OidcRoleMappingSource.env ? (
				<Icon name="lock.fill" size={16} color={colors.tertiaryLabel} />
			) : null}
		</LongPressMenu>
	);
}

export function OIDCRoleMappingsDestination() {
	const model = useOIDCRoleMappings();
	const [refreshing, setRefreshing] = useState(false);
	const { mappings } = model;

	let content;
	if (!model.rbacAvailable) {
		content = (
			<CenteredMessage
				icon="lock.slash"
				title="OIDC Role Mappings Not Available"
				message="Requires Arcane v2 or newer."
			/>
		);
	} else if (!model.canManage) {
		content = (
			<CenteredMessage
				icon="lock.fill"
				title="Admin Required"
				message="Only global administrators can manage OIDC role mappings."
			/>
		);
	} else if (model.isLoading && mappings.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading mappings…" />
			</View>
		);
	} else if (model.errorMessage !== undefined && mappings.length === 0) {
		content = (
			<CenteredMessage icon="exclamationmark.triangle" title="Error" message={model.errorMessage} />
		);
	} else if (mappings.length === 0) {
		content = (
			<CenteredMessage
				icon="person.badge.key"
				title="No Mappings"
				message="Map an SSO claim value to a role to grant it on login."
			/>
		);
	} else {
		content = (
			<>
				<ResourceCountSectionHeader title="Mappings" loadedCount={mappings.length} />
				<MaterialListGroup>
					{mappings.map((mapping, index) => (
						<View key={mapping.id}>
							{index > 0 ? (
								<View style={{ height: 0.5, marginLeft: 62, backgroundColor: colors.separator }} />
							) : null}
							<MappingItem model={model} mapping={mapping} />
						</View>
					))}
				</MaterialListGroup>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'OIDC Role Mappings' }} />
			{model.rbacAvailable && model.canManage ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'add',
							icon: 'plus',
							label: 'Add Role Mapping',
							onPress: model.openCreate
						}
					]}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
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
				title="Couldn't Delete Mapping"
				message={model.actionErrorMessage}
				onDismiss={model.dismissActionError}
			/>
		</>
	);
}
