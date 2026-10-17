/** Android rendering of ContainersView's toolbar and selection toolbar. */
import { systemColors } from '@/theme/colors';
import { maintenanceActionInfo } from '@/ui/components/all-environments-maintenance';
import { environmentTitle } from '@/ui/components/environment-label.types';

import { AndroidToolbar, type AndroidMenuItem, type AndroidToolbarItem } from './android-toolbar';
import type { ContainersListModel } from './use-containers-list';

export function ContainersToolbar({ model }: { model: ContainersListModel }) {
	if (model.isSelecting) {
		const { primary, secondary, overflow, runningItemID, isDisabled, active } = model.bulkToolbar;
		const disabled = (id: string) =>
			isDisabled || (runningItemID !== undefined && runningItemID !== id);
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
							disabled: disabled(primary.id),
							onPress: primary.action
						}
			);
		}
		const menuItems = [...secondary, ...overflow];
		if (active && menuItems.length > 0) {
			items.push({
				kind: 'menu',
				id: 'bulk',
				icon: 'ellipsis.circle',
				label: 'More actions',
				disabled: isDisabled,
				items: menuItems.map((item) => ({
					id: item.id,
					title: item.title,
					destructive: item.tint === systemColors.red,
					disabled: disabled(item.id),
					onPress: item.action
				}))
			});
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

	const options: AndroidMenuItem[] = [
		{ id: 'select', title: 'Select', onPress: model.enterSelectionMode }
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
	} else {
		if (model.canStartAll) {
			options.push(
				{ id: 'start-all', title: 'Start All', onPress: model.startAll },
				{ id: 'start-stopped', title: 'Start Stopped', onPress: model.startStopped }
			);
		}
		if (model.canStopAll)
			options.push({
				id: 'stop-all',
				title: 'Stop All',
				destructive: true,
				onPress: model.requestStopAll
			});
	}
	options.push({
		id: 'prune',
		title: 'Prune Stopped Containers',
		destructive: true,
		disabled: model.allEnvironments && model.isOperationRunning,
		onPress: model.requestPrune
	});

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
	if (model.createEnvironments.length > 0) {
		items.push(
			model.allEnvironments
				? {
						kind: 'menu',
						id: 'create',
						icon: 'plus',
						label: 'Create container',
						items: model.createEnvironments.map((environment) => ({
							id: environment.id,
							title: environmentTitle(environment),
							onPress: () => model.presentCreateContainer(environment.id)
						}))
					}
				: {
						kind: 'button',
						id: 'create',
						icon: 'plus',
						label: 'Create container',
						onPress: () => model.presentCreateContainer(model.environmentID)
					}
		);
	}
	items.push({
		kind: 'menu',
		id: 'options',
		icon: 'ellipsis.circle',
		label: 'More options',
		items: options
	});
	return <AndroidToolbar items={items} />;
}
