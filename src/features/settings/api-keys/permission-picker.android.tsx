/**
 * Material rendering of `PermissionPickerView` (RBAC/PermissionPickerView.swift):
 * one expandable card per resource with a tri-state select-all checkbox and a
 * switch per permission. Standalone.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { PermissionResource } from '@/sdk/models/role/PermissionsManifest';
import { PermissionResource as PermissionResourceModel } from '@/sdk/models/role/PermissionsManifest';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import {
	actionTitle,
	colorForResource,
	filteredResources,
	iconForResource,
	resourceSelection,
	toggleAction,
	toggleResource,
	type PermissionPickerProps
} from './permission-picker-logic';
import { M3Switch } from '@/ui/material/switch';

function ResourceCard({
	resource,
	expanded,
	onToggleExpanded,
	selected,
	onSelectedChange,
	isReadOnly = false
}: {
	resource: PermissionResource;
	expanded: boolean;
	onToggleExpanded: () => void;
} & PermissionPickerProps) {
	const { selectedCount, totalCount, allSelected, partiallySelected } = resourceSelection(
		resource,
		selected
	);
	return (
		<View style={{ marginTop: 12 }}>
			<MaterialListGroup>
				<Pressable
					onPress={onToggleExpanded}
					accessibilityRole="button"
					accessibilityState={{ expanded }}
					android_ripple={{ color: colors.separator as string }}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 12,
						minHeight: 64,
						paddingHorizontal: 16
					}}
				>
					<Icon
						name={iconForResource(resource.key)}
						size={22}
						color={colorForResource(resource.key) ?? colors.secondaryLabel}
					/>
					<View style={{ flex: 1, gap: 2 }}>
						<Text style={[m3Type.titleMedium, { color: colors.label }]}>{resource.label}</Text>
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							{`${selectedCount}/${totalCount} selected`}
							{PermissionResourceModel.scopeKind(resource) === 'global' ? ' · Global' : ''}
						</Text>
					</View>
					<Pressable
						onPress={() => onSelectedChange(toggleResource(resource, selected))}
						disabled={isReadOnly}
						accessibilityRole="checkbox"
						accessibilityState={{
							checked: allSelected ? true : partiallySelected ? 'mixed' : false,
							disabled: isReadOnly
						}}
						accessibilityLabel={
							allSelected ? `Deselect all in ${resource.label}` : `Select all in ${resource.label}`
						}
						android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
						style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
					>
						<Icon
							name={
								allSelected
									? 'checkmark.square.fill'
									: partiallySelected
										? 'minus.square.fill'
										: 'square'
							}
							size={24}
							color={allSelected || partiallySelected ? m3.primary : colors.secondaryLabel}
						/>
					</Pressable>
					<Icon
						name={expanded ? 'chevron.up' : 'chevron.down'}
						size={18}
						color={colors.secondaryLabel}
					/>
				</Pressable>
				{expanded
					? resource.actions.map((action) => (
							<View
								key={action.permission}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 16,
									paddingHorizontal: 16,
									paddingVertical: 10,
									opacity: isReadOnly ? 0.5 : 1
								}}
							>
								<View style={{ flex: 1, gap: 2 }}>
									<Text style={[m3Type.bodyLarge, { color: colors.label }]}>
										{actionTitle(action)}
									</Text>
									{action.description ? (
										<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
											{action.description}
										</Text>
									) : null}
									<Text
										style={[
											m3Type.labelSmall,
											{ color: colors.tertiaryLabel, fontFamily: monoFamily }
										]}
									>
										{action.permission}
									</Text>
								</View>
								<M3Switch
									value={selected.has(action.permission)}
									disabled={isReadOnly}
									onValueChange={(isOn) => onSelectedChange(toggleAction(action, isOn, selected))}
									accessibilityLabel={actionTitle(action)}
								/>
							</View>
						))
					: null}
			</MaterialListGroup>
		</View>
	);
}

export function PermissionPicker(props: PermissionPickerProps) {
	const [expandedResources, setExpandedResources] = useState<ReadonlySet<string>>(new Set());
	return (
		<>
			{filteredResources(props.manifest, props.search).map((resource) => (
				<ResourceCard
					key={resource.key}
					resource={resource}
					expanded={expandedResources.has(resource.key) || props.search !== ''}
					onToggleExpanded={() =>
						setExpandedResources((current) => {
							const next = new Set(current);
							if (next.has(resource.key)) next.delete(resource.key);
							else next.add(resource.key);
							return next;
						})
					}
					{...props}
				/>
			))}
		</>
	);
}
