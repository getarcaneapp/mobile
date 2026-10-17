/**
 * Logic for `PermissionPickerView` (RBAC/PermissionPickerView.swift): search
 * filtering, per-resource selection counts, icons and tints. Pure TS.
 */
import type {
	PermissionAction,
	PermissionResource,
	PermissionsManifest
} from '@/sdk/models/role/PermissionsManifest';
import { systemColors } from '@/theme/colors';

export type PermissionPickerProps = {
	manifest: PermissionsManifest;
	selected: ReadonlySet<string>;
	onSelectedChange: (selected: Set<string>) => void;
	isReadOnly?: boolean;
	search: string;
};

export function filteredResources(
	manifest: PermissionsManifest,
	search: string
): PermissionResource[] {
	if (search === '') return manifest.resources;
	const q = search.toLowerCase();
	return manifest.resources.flatMap((resource) => {
		if (resource.label.toLowerCase().includes(q) || resource.key.toLowerCase().includes(q))
			return [resource];
		const actions = resource.actions.filter(
			(action) =>
				action.label.toLowerCase().includes(q) ||
				action.permission.toLowerCase().includes(q) ||
				(action.description ?? '').toLowerCase().includes(q)
		);
		return actions.length === 0 ? [] : [{ ...resource, actions }];
	});
}

export function resourceSelection(resource: PermissionResource, selected: ReadonlySet<string>) {
	const selectedCount = resource.actions.filter((action) => selected.has(action.permission)).length;
	const totalCount = resource.actions.length;
	const allSelected = selectedCount === totalCount && totalCount > 0;
	return {
		selectedCount,
		totalCount,
		allSelected,
		partiallySelected: selectedCount > 0 && !allSelected
	};
}

/** The header's select-all / deselect-all button. */
export function toggleResource(
	resource: PermissionResource,
	selected: ReadonlySet<string>
): Set<string> {
	const next = new Set(selected);
	const { allSelected } = resourceSelection(resource, selected);
	for (const action of resource.actions) {
		if (allSelected) next.delete(action.permission);
		else next.add(action.permission);
	}
	return next;
}

export function toggleAction(
	action: PermissionAction,
	isOn: boolean,
	selected: ReadonlySet<string>
): Set<string> {
	const next = new Set(selected);
	if (isOn) next.add(action.permission);
	else next.delete(action.permission);
	return next;
}

export const actionTitle = (action: PermissionAction) =>
	action.label === '' ? action.key : action.label;

export function iconForResource(key: string): string {
	switch (key) {
		case 'containers':
			return 'cube.box.fill';
		case 'images':
			return 'square.3.layers.3d.top.filled';
		case 'projects':
			return 'folder.fill';
		case 'volumes':
			return 'externaldrive.fill';
		case 'networks':
			return 'network';
		case 'swarm':
			return 'square.stack.3d.up';
		case 'users':
			return 'person.2.fill';
		case 'roles':
			return 'person.crop.rectangle.stack.fill';
		case 'apikeys':
			return 'key.fill';
		case 'settings':
			return 'slider.horizontal.3';
		case 'environments':
			return 'server.rack';
		case 'registries':
			return 'shippingbox.fill';
		case 'templates':
			return 'doc.text.fill';
		case 'git-repositories':
			return 'arrow.triangle.branch';
		case 'gitops':
			return 'arrow.triangle.merge';
		case 'webhooks':
			return 'link.badge.plus';
		case 'system':
			return 'gearshape.fill';
		case 'vulnerabilities':
			return 'ladybug.fill';
		case 'image-updates':
			return 'arrow.triangle.2.circlepath';
		case 'events':
			return 'clock.badge.exclamationmark';
		case 'dashboard':
			return 'chart.bar.fill';
		case 'jobs':
			return 'calendar.badge.clock';
		case 'notifications':
			return 'bell.badge.fill';
		case 'customize':
			return 'paintbrush.fill';
		case 'build-workspaces':
			return 'hammer.fill';
		default:
			return 'lock.fill';
	}
}

/** Hex tint, or undefined for `.secondary`. */
export function colorForResource(key: string): string | undefined {
	switch (key) {
		case 'containers':
		case 'images':
		case 'projects':
		case 'users':
		case 'authentication':
			return systemColors.blue;
		case 'volumes':
			return systemColors.orange;
		case 'networks':
			return systemColors.teal;
		case 'swarm':
			return systemColors.mint;
		case 'registries':
		case 'roles':
			return systemColors.purple;
		case 'templates':
		case 'git-repositories':
		case 'gitops':
			return systemColors.indigo;
		case 'webhooks':
			return systemColors.green;
		case 'system':
		case 'settings':
			return systemColors.gray;
		case 'vulnerabilities':
		case 'events':
			return systemColors.red;
		case 'apikeys':
			return systemColors.yellow;
		case 'jobs':
			return systemColors.pink;
		default:
			return undefined;
	}
}
