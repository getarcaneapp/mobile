/** Android rendering of VolumesView's toolbar and selection toolbar. */
import { environmentTitle } from '@/ui/components/environment-label.types';

import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';

import type { VolumesListModel } from './use-volumes-list';

export function VolumesToolbar({ model }: { model: VolumesListModel }) {
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
		return <AndroidToolbar items={items} />;
	}

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
	if (model.allEnvironments) {
		if (model.createEnvironments.length > 0) {
			items.push({
				kind: 'menu',
				id: 'create',
				icon: 'plus',
				label: 'Create volume',
				items: model.createEnvironments.map((environment) => ({
					id: environment.id,
					title: environmentTitle(environment),
					onPress: () => model.presentCreate(environment.id)
				}))
			});
		}
	} else {
		items.push({
			kind: 'button',
			id: 'create',
			icon: 'plus',
			label: 'Create volume',
			onPress: () => model.presentCreate(model.environmentID)
		});
	}
	items.push({
		kind: 'menu',
		id: 'options',
		icon: 'ellipsis.circle',
		label: 'More options',
		items: [
			{ id: 'select', title: 'Select', onPress: model.enterSelectionMode },
			{
				id: 'prune',
				title: 'Prune Unused Volumes',
				destructive: true,
				disabled: model.allEnvironments && model.isOperationRunning,
				onPress: model.requestPrune
			}
		]
	});
	return <AndroidToolbar items={items} />;
}
