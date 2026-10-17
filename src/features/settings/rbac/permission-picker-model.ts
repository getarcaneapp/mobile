import { useState } from 'react';

import {
	PermissionResource,
	PermissionResourceScope,
	type PermissionAction,
	type PermissionsManifest
} from '@/sdk/models/role/PermissionsManifest';
import { systemColors } from '@/theme/colors';

export type PermissionPickerProps = {
	manifest: PermissionsManifest;
	selected: Set<string>;
	onSetPermissions: (permissions: string[], selected: boolean) => void;
	isReadOnly?: boolean;
	search: string;
};

export function filterResources(
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

export function resourceSelection(resource: PermissionResource, selected: Set<string>) {
	const selectedCount = resource.actions.filter((action) => selected.has(action.permission)).length;
	const totalCount = resource.actions.length;
	const allSelected = selectedCount === totalCount && totalCount > 0;
	const partiallySelected = selectedCount > 0 && !allSelected;
	return {
		selectedCount,
		totalCount,
		allSelected,
		partiallySelected,
		isGlobal: PermissionResource.scopeKind(resource) === PermissionResourceScope.global,
		checkboxSymbol: allSelected
			? 'checkmark.square.fill'
			: partiallySelected
				? 'minus.square.fill'
				: 'square',
		toggleLabel: allSelected
			? `Deselect all in ${resource.label}`
			: `Select all in ${resource.label}`
	};
}

export function actionTitle(action: PermissionAction): string {
	return action.label === '' ? action.key : action.label;
}

export function useResourceExpansion(search: string) {
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
	return {
		isExpanded: (key: string) => expanded.has(key) || search !== '',
		setExpanded: (key: string, isExpanded: boolean) =>
			setExpanded((current) => {
				const next = new Set(current);
				if (isExpanded) next.add(key);
				else next.delete(key);
				return next;
			})
	};
}

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
			return systemColors.red;
		case 'roles':
			return systemColors.purple;
		case 'apikeys':
			return systemColors.yellow;
		case 'events':
			return systemColors.red;
		case 'jobs':
			return systemColors.pink;
		default:
			return undefined;
	}
}
