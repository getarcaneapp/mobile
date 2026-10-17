/**
 * `AllEnvironmentsMaintenanceButtons` as SwiftUI `Button`s for an in-tree
 * `Menu`. Pair with `useAllEnvironmentsMaintenanceConfirmation`.
 *
 * SwiftUI-tree (place inside a `Menu`).
 */
import { Button } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';

import {
	maintenanceActionInfo,
	type AllEnvironmentsMaintenanceAction
} from './all-environments-maintenance';

export function AllEnvironmentsMaintenanceButtons({
	onSelect,
	isRunning
}: {
	onSelect: (action: AllEnvironmentsMaintenanceAction) => void;
	isRunning: boolean;
}) {
	return (
		<>
			<Button
				label={maintenanceActionInfo.update.buttonTitle}
				systemImage="arrow.triangle.2.circlepath"
				onPress={() => onSelect('update')}
				modifiers={[disabled(isRunning)]}
			/>
			<Button
				label={maintenanceActionInfo.checkImages.buttonTitle}
				systemImage="arrow.clockwise"
				onPress={() => onSelect('checkImages')}
				modifiers={[disabled(isRunning)]}
			/>
		</>
	);
}
