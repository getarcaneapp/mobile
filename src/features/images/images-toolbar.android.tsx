/** Android rendering of ImagesView's toolbar and selection toolbar. */
import {
	AndroidToolbar,
	type AndroidMenuItem,
	type AndroidToolbarItem
} from '@/features/containers/android-toolbar';
import { maintenanceActionInfo } from '@/ui/components/all-environments-maintenance';
import {
	environmentActionIsMenu,
	environmentTitle,
	type ListEnvironment
} from '@/ui/components/environment-label.types';

import type { ImagesListModel } from './use-images-list';

/** `EnvironmentActionButton` flattened into an overflow menu: one entry, or one per environment. */
function environmentEntries(
	id: string,
	title: string,
	environments: ListEnvironment[],
	action: (environmentID: string) => void
): AndroidMenuItem[] {
	if (environmentActionIsMenu(environments)) {
		return environments.map((environment) => ({
			id: `${id}-${environment.id}`,
			title: `${title} · ${environmentTitle(environment)}`,
			onPress: () => action(environment.id)
		}));
	}
	const first = environments[0];
	return first ? [{ id, title, onPress: () => action(first.id) }] : [];
}

export function ImagesToolbar({ model }: { model: ImagesListModel }) {
	const leading: AndroidToolbarItem[] = model.isAdmin
		? [
				{
					kind: 'button',
					id: 'registries',
					icon: 'key.shield',
					label: 'Container Registries',
					onPress: model.openRegistries
				}
			]
		: [];

	if (model.isSelecting) {
		const { primary, runningItemID, isDisabled, active } = model.bulkToolbar;
		const items: AndroidToolbarItem[] = [];
		if (active && primary) {
			items.push(
				runningItemID === primary.id
					? { kind: 'spinner', id: primary.id, label: primary.title }
					: {
							kind: 'button',
							id: primary.id,
							icon: primary.systemImage,
							label: primary.title,
							color: primary.tint,
							disabled: isDisabled,
							onPress: primary.action
						}
			);
		}
		items.push({
			kind: 'button',
			id: 'done',
			icon: 'xmark',
			label: 'Done',
			onPress: model.exitSelectionMode
		});
		return <AndroidToolbar items={[...leading, ...items]} />;
	}

	const environments = model.listEnvironments;
	const pruneDisabled = model.allEnvironments && model.isOperationRunning;
	const options: AndroidMenuItem[] = [
		{ id: 'select', title: 'Select', onPress: model.enterSelectionMode },
		...(model.allEnvironments
			? environmentEntries('updates', 'Updates', environments, model.openUpdates)
			: [
					{ id: 'updates', title: 'Updates', onPress: () => model.openUpdates(model.environmentID) }
				]),
		{ id: 'security', title: 'Security', onPress: model.openSecurity },
		...environmentEntries('upload', 'Upload tarball…', environments, model.presentUpload)
	];
	if (model.allEnvironments) {
		options.push(
			{
				id: 'update-all',
				title: maintenanceActionInfo.update.buttonTitle,
				disabled: model.isOperationRunning,
				onPress: () => model.selectMaintenance('update')
			},
			{
				id: 'check-all',
				title: maintenanceActionInfo.checkImages.buttonTitle,
				disabled: model.isOperationRunning,
				onPress: () => model.selectMaintenance('checkImages')
			}
		);
	}
	options.push(
		{
			id: 'prune-dangling',
			title: 'Quick Prune (Dangling)',
			destructive: true,
			disabled: pruneDisabled,
			onPress: () => model.requestPrune('images')
		},
		{
			id: 'prune-unused',
			title: 'Prune All Unused',
			destructive: true,
			disabled: pruneDisabled,
			onPress: () => model.requestPrune('unusedImages')
		},
		...environmentEntries(
			'prune-options',
			'Prune Options…',
			environments,
			model.presentPruneOptions
		)
	);

	const items: AndroidToolbarItem[] = [
		{
			kind: 'button',
			id: 'filter',
			icon:
				model.activeFilterCount > 0
					? 'line.3.horizontal.decrease.circle.fill'
					: 'line.3.horizontal.decrease.circle',
			label: 'Filter',
			onPress: model.openFilter
		}
	];
	if (model.allEnvironments && environmentActionIsMenu(environments)) {
		items.push({
			kind: 'menu',
			id: 'pull',
			icon: 'arrow.down.circle',
			label: 'Pull image',
			items: environments.map((environment) => ({
				id: environment.id,
				title: environmentTitle(environment),
				onPress: () => model.presentPull(environment.id)
			}))
		});
	} else {
		const pullEnvironmentID = model.allEnvironments ? environments[0]?.id : model.environmentID;
		if (pullEnvironmentID !== undefined) {
			items.push({
				kind: 'button',
				id: 'pull',
				icon: 'arrow.down.circle',
				label: 'Pull image',
				onPress: () => model.presentPull(pullEnvironmentID)
			});
		}
	}
	items.push({
		kind: 'menu',
		id: 'options',
		icon: 'ellipsis.circle',
		label: 'More options',
		items: options
	});
	return <AndroidToolbar items={[...leading, ...items]} />;
}
