import { Stack } from 'expo-router';

import { useAccentColor } from '@/theme/accent';

import { useItemDeleteConfirmation } from './delete-confirmation';

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
