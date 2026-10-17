/**
 * VolumesView's toolbar (filter, options menu, create) and its selection
 * toolbar (bulk delete + Done). Native header items.
 */
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { ActivityIndicator } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { androidOnlyIcon, useToolbarIcons } from '@/ui/toolbar-icon';

import type { VolumesListModel } from './use-volumes-list';

export function VolumesToolbar({ model }: { model: VolumesListModel }) {
	const accent = useAccentColor();
	const filterIcon =
		model.activeFilterCount > 0
			? 'line.3.horizontal.decrease.circle.fill'
			: 'line.3.horizontal.decrease.circle';
	const icon = useToolbarIcons([filterIcon, 'ellipsis.circle', 'plus', 'xmark', 'trash']);

	if (model.isSelecting) {
		const { primary, runningItemID, isDisabled, active } = model.bulkToolbar;
		return (
			<AppToolbar placement="right" tintColor={accent}>
				{active && primary ? (
					runningItemID === primary.id ? (
						<Stack.Toolbar.View>
							<ActivityIndicator accessibilityLabel={primary.title} />
						</Stack.Toolbar.View>
					) : (
						<Stack.Toolbar.Button
							icon={icon(primary.systemImage)}
							tintColor={primary.tint}
							accessibilityLabel={primary.title}
							disabled={isDisabled}
							onPress={primary.action}
						/>
					)
				) : null}
				<Stack.Toolbar.Button
					icon={androidOnlyIcon(icon, 'xmark')}
					accessibilityLabel="Done"
					onPress={model.exitSelectionMode}
				>
					Done
				</Stack.Toolbar.Button>
			</AppToolbar>
		);
	}

	const createEnvironments = model.createEnvironments;
	const createIsMenu = model.allEnvironments && environmentActionIsMenu(createEnvironments);
	const firstCreate = createEnvironments[0];
	return (
		<AppToolbar placement="right" tintColor={accent}>
			<Stack.Toolbar.Button
				icon={icon(filterIcon)}
				accessibilityLabel="Filter"
				onPress={model.openFilter}
			/>
			<Stack.Toolbar.Menu icon={icon('ellipsis.circle')} accessibilityLabel="More options">
				<Stack.Toolbar.MenuAction icon="checklist" onPress={model.enterSelectionMode}>
					Select
				</Stack.Toolbar.MenuAction>
				<Stack.Toolbar.Menu inline>
					<Stack.Toolbar.MenuAction
						icon="trash"
						destructive
						disabled={model.allEnvironments && model.isOperationRunning}
						onPress={model.requestPrune}
					>
						Prune Unused Volumes
					</Stack.Toolbar.MenuAction>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar.Menu>
			{createIsMenu ? (
				<Stack.Toolbar.Menu
					icon={icon('plus')}
					separateBackground
					accessibilityLabel="Create volume"
				>
					{createEnvironments.map((environment) => (
						<Stack.Toolbar.MenuAction
							key={environment.id}
							onPress={() => model.presentCreate(environment.id)}
						>
							{environmentTitle(environment)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : model.allEnvironments ? (
				firstCreate ? (
					<Stack.Toolbar.Button
						icon={icon('plus')}
						separateBackground
						accessibilityLabel="Create volume"
						onPress={() => model.presentCreate(firstCreate.id)}
					/>
				) : null
			) : (
				<Stack.Toolbar.Button
					icon={icon('plus')}
					separateBackground
					accessibilityLabel="Create volume"
					onPress={() => model.presentCreate(model.environmentID)}
				/>
			)}
		</AppToolbar>
	);
}
