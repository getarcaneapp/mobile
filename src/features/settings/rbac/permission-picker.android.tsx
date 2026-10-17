/**
 * Android rendering of `PermissionPickerView` (PermissionPickerView.swift):
 * one expandable Material card per resource with a tri-state select-all
 * checkbox and a switch per action. A non-empty search expands every match.
 *
 * Standalone (RN views).
 */
import { Pressable, Text, View } from 'react-native';

import type { PermissionAction, PermissionResource } from '@/sdk/models/role/PermissionsManifest';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import {
	actionTitle,
	colorForResource,
	filterResources,
	iconForResource,
	resourceSelection,
	useResourceExpansion,
	type PermissionPickerProps
} from './permission-picker-model';
import { M3Switch } from '@/ui/material/switch';

type RowProps = Omit<PermissionPickerProps, 'manifest' | 'search'>;

function ResourceHeader({
	resource,
	selected,
	onSetPermissions,
	isReadOnly,
	isExpanded,
	onToggleExpanded
}: RowProps & { resource: PermissionResource; isExpanded: boolean; onToggleExpanded: () => void }) {
	const state = resourceSelection(resource, selected);
	const permissions = resource.actions.map((action) => action.permission);
	return (
		<Pressable
			onPress={onToggleExpanded}
			accessibilityRole="button"
			accessibilityState={{ expanded: isExpanded }}
			android_ripple={{ color: colors.separator as string }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 64,
				paddingLeft: 16,
				paddingRight: 4,
				paddingVertical: 8
			}}
		>
			<Icon
				name={iconForResource(resource.key)}
				size={22}
				color={colorForResource(resource.key) ?? colors.secondaryLabel}
			/>
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label }]}>{resource.label}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
					{`${state.selectedCount}/${state.totalCount} selected`}
					{state.isGlobal ? <Text style={{ color: colors.tertiaryLabel }}> · Global</Text> : null}
				</Text>
			</View>
			<Pressable
				onPress={() => onSetPermissions(permissions, !state.allSelected)}
				disabled={isReadOnly}
				accessibilityRole="checkbox"
				accessibilityLabel={state.toggleLabel}
				accessibilityState={{
					checked: state.allSelected ? true : state.partiallySelected ? 'mixed' : false,
					disabled: isReadOnly
				}}
				android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
				style={{
					width: 48,
					height: 48,
					alignItems: 'center',
					justifyContent: 'center',
					opacity: isReadOnly ? 0.38 : 1
				}}
			>
				<Icon
					name={state.checkboxSymbol}
					size={24}
					color={
						(state.allSelected || state.partiallySelected
							? m3.primary
							: m3.onSurfaceVariant) as string
					}
				/>
			</Pressable>
			<Icon
				name={isExpanded ? 'chevron.up' : 'chevron.down'}
				size={20}
				color={m3.onSurfaceVariant}
			/>
		</Pressable>
	);
}

function ActionSwitch({
	action,
	selected,
	onSetPermissions,
	isReadOnly
}: RowProps & { action: PermissionAction }) {
	const isOn = selected.has(action.permission);
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				paddingHorizontal: 16,
				paddingVertical: 10,
				opacity: isReadOnly ? 0.6 : 1
			}}
		>
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{actionTitle(action)}</Text>
				{action.description ? (
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{action.description}
					</Text>
				) : null}
				<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel, fontFamily: monoFamily }]}>
					{action.permission}
				</Text>
			</View>
			<M3Switch
				value={isOn}
				disabled={isReadOnly}
				onValueChange={(value) => onSetPermissions([action.permission], value)}
				accessibilityLabel={actionTitle(action)}
			/>
		</View>
	);
}

export function PermissionPicker({
	manifest,
	selected,
	onSetPermissions,
	isReadOnly = false,
	search
}: PermissionPickerProps) {
	const expansion = useResourceExpansion(search);
	return (
		<>
			{filterResources(manifest, search).map((resource) => {
				const isExpanded = expansion.isExpanded(resource.key);
				return (
					<View key={resource.key} style={{ paddingTop: 12 }}>
						<MaterialListGroup>
							<ResourceHeader
								resource={resource}
								selected={selected}
								onSetPermissions={onSetPermissions}
								isReadOnly={isReadOnly}
								isExpanded={isExpanded}
								onToggleExpanded={() => expansion.setExpanded(resource.key, !isExpanded)}
							/>
							{isExpanded
								? resource.actions.map((action) => (
										<View key={action.permission}>
											<View
												style={{ height: 0.5, marginLeft: 16, backgroundColor: colors.separator }}
											/>
											<ActionSwitch
												action={action}
												selected={selected}
												onSetPermissions={onSetPermissions}
												isReadOnly={isReadOnly}
											/>
										</View>
									))
								: null}
						</MaterialListGroup>
					</View>
				);
			})}
		</>
	);
}
