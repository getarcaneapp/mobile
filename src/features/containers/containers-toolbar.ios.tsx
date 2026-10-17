import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { ActivityIndicator } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { maintenanceActionInfo } from '@/ui/components/all-environments-maintenance';
import { androidOnlyIcon, useToolbarIcons } from '@/ui/toolbar-icon';
import { environmentTitle } from '@/ui/components/environment-label.types';

import type { ContainersListModel } from './use-containers-list';

export function ContainersToolbar({ model }: { model: ContainersListModel }) {
	const accent = useAccentColor();
	const filterIcon =
		model.activeFilterCount > 0
			? 'line.3.horizontal.decrease.circle.fill'
			: 'line.3.horizontal.decrease.circle';
	const icon = useToolbarIcons([
		filterIcon,
		'ellipsis.circle',
		'plus',
		'xmark',
		model.bulkToolbar.primary?.systemImage ?? ''
	]);
	if (model.isSelecting) {
		const { primary, secondary, overflow, runningItemID, isDisabled, active } = model.bulkToolbar;
		const menuItems = [...secondary, ...overflow];
		const disabled = (id: string) =>
			isDisabled || (runningItemID !== undefined && runningItemID !== id);
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
							disabled={disabled(primary.id)}
							onPress={primary.action}
						/>
					)
				) : null}
				{active && menuItems.length > 0 ? (
					<Stack.Toolbar.Menu
						icon={icon('ellipsis.circle')}
						accessibilityLabel="More actions"
						disabled={isDisabled}
					>
						{menuItems.map((item) => (
							<Stack.Toolbar.MenuAction
								key={item.id}
								icon={item.systemImage as SFSymbol}
								destructive={item.tint === systemColors.red}
								disabled={disabled(item.id)}
								onPress={item.action}
							>
								{item.title}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
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
				{model.allEnvironments ? (
					<Stack.Toolbar.Menu inline>
						<Stack.Toolbar.MenuAction
							icon="arrow.triangle.2.circlepath"
							disabled={model.isOperationRunning}
							onPress={() => model.selectMaintenance('update')}
						>
							{maintenanceActionInfo.update.buttonTitle}
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.MenuAction
							icon="arrow.clockwise"
							disabled={model.isOperationRunning}
							onPress={() => model.selectMaintenance('checkImages')}
						>
							{maintenanceActionInfo.checkImages.buttonTitle}
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
				) : model.canStartAll || model.canStopAll ? (
					<Stack.Toolbar.Menu inline>
						{model.canStartAll ? (
							<Stack.Toolbar.MenuAction icon="play.fill" onPress={model.startAll}>
								Start All
							</Stack.Toolbar.MenuAction>
						) : null}
						{model.canStartAll ? (
							<Stack.Toolbar.MenuAction icon="play" onPress={model.startStopped}>
								Start Stopped
							</Stack.Toolbar.MenuAction>
						) : null}
						{model.canStopAll ? (
							<Stack.Toolbar.MenuAction icon="stop.fill" destructive onPress={model.requestStopAll}>
								Stop All
							</Stack.Toolbar.MenuAction>
						) : null}
					</Stack.Toolbar.Menu>
				) : null}
				<Stack.Toolbar.Menu inline>
					<Stack.Toolbar.MenuAction
						icon="trash"
						destructive
						disabled={model.allEnvironments && model.isOperationRunning}
						onPress={model.requestPrune}
					>
						Prune Stopped Containers
					</Stack.Toolbar.MenuAction>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar.Menu>
			{createEnvironments.length > 0 && model.allEnvironments ? (
				<Stack.Toolbar.Menu
					icon={icon('plus')}
					separateBackground
					accessibilityLabel="Create container"
				>
					{createEnvironments.map((environment) => (
						<Stack.Toolbar.MenuAction
							key={environment.id}
							onPress={() => model.presentCreateContainer(environment.id)}
						>
							{environmentTitle(environment)}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			) : null}
			{createEnvironments.length > 0 && !model.allEnvironments ? (
				<Stack.Toolbar.Button
					icon={icon('plus')}
					separateBackground
					accessibilityLabel="Create container"
					onPress={() => model.presentCreateContainer(model.environmentID)}
				/>
			) : null}
		</AppToolbar>
	);
}
