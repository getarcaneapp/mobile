/**
 * Port of `PermissionPickerView` (RBAC/PermissionPickerView.swift): one
 * Section + DisclosureGroup per resource, composed into the surrounding Form.
 * Matching resources auto-expand while searching.
 *
 * SwiftUI-tree.
 */
import {
	Button,
	DisclosureGroup,
	HStack,
	Section,
	Spacer,
	Text,
	Toggle,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	frame
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { PermissionResource } from '@/sdk/models/role/PermissionsManifest';
import { PermissionResource as PermissionResourceModel } from '@/sdk/models/role/PermissionsManifest';
import { useAccentColor } from '@/theme/accent';

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

function ResourceHeader({
	resource,
	selected,
	onSelectedChange,
	isReadOnly
}: { resource: PermissionResource } & PermissionPickerProps) {
	const accent = useAccentColor();
	const { selectedCount, totalCount, allSelected, partiallySelected } = resourceSelection(
		resource,
		selected
	);
	return (
		<HStack spacing={12}>
			<Image
				systemName={iconForResource(resource.key) as SFSymbol}
				modifiers={[
					foregroundStyle(colorForResource(resource.key) ?? 'secondary'),
					frame({ width: 22 })
				]}
			/>
			<VStack alignment="leading" spacing={2}>
				<Text
					modifiers={[font({ textStyle: 'body', weight: 'semibold' }), foregroundStyle('primary')]}
				>
					{resource.label}
				</Text>
				<HStack spacing={4}>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>{`${selectedCount}/${totalCount} selected`}</Text>
					{PermissionResourceModel.scopeKind(resource) === 'global' ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
							]}
						>
							· Global
						</Text>
					) : null}
				</HStack>
			</VStack>
			<Spacer minLength={0} />
			<Button
				onPress={() => onSelectedChange(toggleResource(resource, selected))}
				modifiers={[
					buttonStyle('plain'),
					disabled(isReadOnly ?? false),
					accessibilityLabel(
						allSelected ? `Deselect all in ${resource.label}` : `Select all in ${resource.label}`
					)
				]}
			>
				<Image
					systemName={
						allSelected
							? 'checkmark.square.fill'
							: partiallySelected
								? 'minus.square.fill'
								: 'square'
					}
					modifiers={[
						font({ textStyle: 'title3' }),
						foregroundStyle(allSelected || partiallySelected ? accent : 'secondary')
					]}
				/>
			</Button>
		</HStack>
	);
}

export function PermissionPicker(props: PermissionPickerProps) {
	const { manifest, selected, onSelectedChange, isReadOnly = false, search } = props;
	const [expandedResources, setExpandedResources] = useState<ReadonlySet<string>>(new Set());
	return (
		<>
			{filteredResources(manifest, search).map((resource) => (
				<Section key={resource.key}>
					<DisclosureGroup
						isExpanded={expandedResources.has(resource.key) || search !== ''}
						onIsExpandedChange={(expanded) =>
							setExpandedResources((current) => {
								const next = new Set(current);
								if (expanded) next.add(resource.key);
								else next.delete(resource.key);
								return next;
							})
						}
					>
						<DisclosureGroup.Label>
							<ResourceHeader resource={resource} {...props} />
						</DisclosureGroup.Label>
						{resource.actions.map((action) => (
							<Toggle
								key={action.permission}
								isOn={selected.has(action.permission)}
								onIsOnChange={(isOn) => onSelectedChange(toggleAction(action, isOn, selected))}
								modifiers={[disabled(isReadOnly)]}
							>
								<VStack alignment="leading" spacing={2}>
									<Text modifiers={[font({ textStyle: 'body' })]}>{actionTitle(action)}</Text>
									{action.description ? (
										<Text
											modifiers={[
												font({ textStyle: 'caption' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' })
											]}
										>
											{action.description}
										</Text>
									) : null}
									<Text
										modifiers={[
											font({ textStyle: 'caption2', design: 'monospaced' }),
											foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
										]}
									>
										{action.permission}
									</Text>
								</VStack>
							</Toggle>
						))}
					</DisclosureGroup>
				</Section>
			))}
		</>
	);
}
