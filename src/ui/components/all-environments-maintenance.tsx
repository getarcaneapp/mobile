/**
 * Port of `AllEnvironmentsMaintenanceButtons` +
 * `.allEnvironmentsMaintenanceConfirmation(action:environments:)`
 * (AllEnvironmentsMaintenanceConfirmation.swift): Update All / Check All for
 * an All Environments list's toolbar menu, confirmed with an accent-tinted
 * card that keeps the screen open. The caller performs the operation
 * (`AllEnvironmentsOperationStore.performMaintenance` in Swift).
 *
 * Standalone (toolbar items, both platforms). SwiftUI-tree menu buttons:
 * `all-environments-maintenance-swiftui`.
 */
import { Stack } from 'expo-router';

import { useAccentColor } from '@/theme/accent';

import { useItemDeleteConfirmation } from './delete-confirmation';

/** Port of `AllEnvironmentsMaintenanceAction`. */
export type AllEnvironmentsMaintenanceAction = 'update' | 'checkImages';

export const maintenanceActionInfo: Record<
	AllEnvironmentsMaintenanceAction,
	{
		title: string;
		buttonTitle: string;
		progressTitle: string;
		completionTitle: string;
		systemImage: string;
		explanation: string;
	}
> = {
	update: {
		title: 'Update All',
		buttonTitle: 'Update All',
		progressTitle: 'Updating resources…',
		completionTitle: 'Updates complete',
		systemImage: 'arrow.triangle.2.circlepath',
		explanation:
			'Run the configured container and project updater on every enabled environment. Containers may restart during updates.'
	},
	checkImages: {
		title: 'Check for Updates',
		buttonTitle: 'Check All',
		progressTitle: 'Checking for updates…',
		completionTitle: 'Updates checked',
		systemImage: 'arrow.clockwise',
		explanation:
			'Check images in every enabled environment for available updates. This does not install updates.'
	}
};

/** Confirms the pending action, then calls `perform`. Pair with the toolbar actions below. */
export function useAllEnvironmentsMaintenanceConfirmation(
	action: AllEnvironmentsMaintenanceAction | undefined,
	setAction: (action: AllEnvironmentsMaintenanceAction | undefined) => void,
	perform: (action: AllEnvironmentsMaintenanceAction) => void
) {
	const accent = useAccentColor();
	useItemDeleteConfirmation(action, setAction, (value) => {
		const info = maintenanceActionInfo[value];
		return {
			title: info.title,
			message: info.explanation,
			icon: info.systemImage,
			actions: [
				{ title: info.buttonTitle, role: null, tint: accent, action: () => perform(value) }
			],
			dismissOnConfirm: false
		};
	});
}

/**
 * Update All and Check All as `Stack.Toolbar.MenuAction`s. Disabled while an operation runs.
 * `Stack.Toolbar.Menu` keeps only direct `MenuAction`/`Menu` children (by element type), so call this
 * as a function inside the menu — `{AllEnvironmentsMaintenanceToolbarActions({ … })}` — not as `<… />`.
 */
export function AllEnvironmentsMaintenanceToolbarActions({
	onSelect,
	isRunning
}: {
	onSelect: (action: AllEnvironmentsMaintenanceAction) => void;
	isRunning: boolean;
}) {
	return [
		<Stack.Toolbar.MenuAction
			key="update"
			icon="arrow.triangle.2.circlepath"
			disabled={isRunning}
			onPress={() => onSelect('update')}
		>
			{maintenanceActionInfo.update.buttonTitle}
		</Stack.Toolbar.MenuAction>,
		<Stack.Toolbar.MenuAction
			key="checkImages"
			icon="arrow.clockwise"
			disabled={isRunning}
			onPress={() => onSelect('checkImages')}
		>
			{maintenanceActionInfo.checkImages.buttonTitle}
		</Stack.Toolbar.MenuAction>
	];
}
