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
import { Image } from '@/ui/components/swiftui-image';
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

import { OidcRoleMapping, OidcRoleMappingSource } from '@/sdk/models/role/OidcRoleMapping';
import type { Role } from '@/sdk/models/role/Role';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { RowIcon } from '@/ui/components/row-icon';

import { ActionErrorAlert } from '../shared/action-error-alert';

import { displayScopeLabel, roleDisplayName, roleIconColor, roleSystemImage } from './rbac-models';
import {
	isManualMapping,
	useOIDCRoleMappings,
	type OIDCRoleMappingsModel
} from './use-oidc-role-mappings';

function MappingRow({
	mapping,
	role,
	environmentLabel
}: {
	mapping: OidcRoleMapping;
	role: Role | undefined;
	environmentLabel: string;
}) {
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RowIcon
				systemImage={role ? roleSystemImage(role) : 'person.badge.key'}
				tint={role ? roleIconColor(role) : systemColors.indigo}
				size={30}
			/>
			<VStack alignment="leading" spacing={3}>
				<HStack spacing={4}>
					<Text modifiers={[font({ textStyle: 'body', design: 'monospaced' })]}>
						{mapping.claimValue}
					</Text>
					<Image
						systemName="arrow.right"
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
						]}
					/>
					<Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>
						{role ? roleDisplayName(role) : mapping.roleId}
					</Text>
				</HStack>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{environmentLabel}
				</Text>
			</VStack>
			<Spacer />
			{OidcRoleMapping.sourceKind(mapping) === OidcRoleMappingSource.env ? (
				<Image
					systemName="lock.fill"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
					]}
				/>
			) : null}
		</HStack>
	);
}

function MappingItem({
	model,
	mapping
}: {
	model: OIDCRoleMappingsModel;
	mapping: OidcRoleMapping;
}) {
	const button = (
		<Button onPress={() => model.openEdit(mapping)} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<MappingRow
					mapping={mapping}
					role={model.roleFor(mapping)}
					environmentLabel={displayScopeLabel(mapping.environmentId, model.availableEnvironments)}
				/>
			</HStack>
		</Button>
	);
	if (!isManualMapping(mapping)) return button;
	return (
		<SwipeActions>
			{button}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					label="Delete"
					systemImage="trash"
					onPress={() => model.requestDelete(mapping)}
					modifiers={[tint(systemColors.red)]}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function OIDCRoleMappingsDestination() {
	const model = useOIDCRoleMappings();
	const accent = useAccentColor();
	const { mappings } = model;

	let content;
	if (!model.rbacAvailable) {
		content = (
			<ContentUnavailableView
				title="OIDC Role Mappings Not Available"
				systemImage="lock.slash"
				description="Requires Arcane v2 or newer."
			/>
		);
	} else if (!model.canManage) {
		content = (
			<ContentUnavailableView
				title="Admin Required"
				systemImage="lock.fill"
				description="Only global administrators can manage OIDC role mappings."
			/>
		);
	} else if (model.isLoading && mappings.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading mappings…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && mappings.length === 0) {
		content = (
			<ContentUnavailableView
				title="Error"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
			/>
		);
	} else if (mappings.length === 0) {
		content = (
			<ContentUnavailableView
				title="No Mappings"
				systemImage="person.badge.key"
				description="Map an SSO claim value to a role to grant it on login."
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
				<Section
					header={<ResourceCountSectionHeader title="Mappings" loadedCount={mappings.length} />}
				>
					{mappings.map((mapping) => (
						<MappingItem key={mapping.id} model={model} mapping={mapping} />
					))}
				</Section>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'OIDC Role Mappings' }} />
			{model.rbacAvailable && model.canManage ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Button
						icon="plus"
						accessibilityLabel="Add Role Mapping"
						onPress={model.openCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				{content}
				<ActionErrorAlert
					title="Couldn't Delete Mapping"
					message={model.actionErrorMessage}
					onDismiss={model.dismissActionError}
				/>
			</Host>
		</>
	);
}
