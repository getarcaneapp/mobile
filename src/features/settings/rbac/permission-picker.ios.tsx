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
import type { SFSymbol } from 'sf-symbols-typescript';

import type { PermissionAction, PermissionResource } from '@/sdk/models/role/PermissionsManifest';
import { useAccentColor } from '@/theme/accent';

import {
	actionTitle,
	colorForResource,
	filterResources,
	iconForResource,
	resourceSelection,
	useResourceExpansion,
	type PermissionPickerProps
} from './permission-picker-model';

const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;

function ResourceHeader({
	resource,
	selected,
	onSetPermissions,
	isReadOnly
}: Omit<PermissionPickerProps, 'manifest' | 'search'> & { resource: PermissionResource }) {
	const accent = useAccentColor();
	const state = resourceSelection(resource, selected);
	const permissions = resource.actions.map((action) => action.permission);
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
					>
						{`${state.selectedCount}/${state.totalCount} selected`}
					</Text>
					{state.isGlobal ? (
						<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(tertiary)]}>
							· Global
						</Text>
					) : null}
				</HStack>
			</VStack>
			<Spacer minLength={0} />
			<Button
				onPress={() => onSetPermissions(permissions, !state.allSelected)}
				modifiers={[
					buttonStyle('plain'),
					disabled(isReadOnly ?? false),
					accessibilityLabel(state.toggleLabel)
				]}
			>
				<Image
					systemName={state.checkboxSymbol as SFSymbol}
					modifiers={[
						font({ textStyle: 'title3' }),
						foregroundStyle(state.allSelected || state.partiallySelected ? accent : 'secondary')
					]}
				/>
			</Button>
		</HStack>
	);
}

function ActionToggle({
	action,
	selected,
	onSetPermissions,
	isReadOnly
}: Omit<PermissionPickerProps, 'manifest' | 'search'> & { action: PermissionAction }) {
	return (
		<Toggle
			isOn={selected.has(action.permission)}
			onIsOnChange={(isOn) => onSetPermissions([action.permission], isOn)}
			modifiers={[disabled(isReadOnly ?? false)]}
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
						foregroundStyle(tertiary)
					]}
				>
					{action.permission}
				</Text>
			</VStack>
		</Toggle>
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
			{filterResources(manifest, search).map((resource) => (
				<Section key={resource.key}>
					<DisclosureGroup
						isExpanded={expansion.isExpanded(resource.key)}
						onIsExpandedChange={(isExpanded) => expansion.setExpanded(resource.key, isExpanded)}
					>
						<DisclosureGroup.Label>
							<ResourceHeader
								resource={resource}
								selected={selected}
								onSetPermissions={onSetPermissions}
								isReadOnly={isReadOnly}
							/>
						</DisclosureGroup.Label>
						{resource.actions.map((action) => (
							<ActionToggle
								key={action.permission}
								action={action}
								selected={selected}
								onSetPermissions={onSetPermissions}
								isReadOnly={isReadOnly}
							/>
						))}
					</DisclosureGroup>
				</Section>
			))}
		</>
	);
}
