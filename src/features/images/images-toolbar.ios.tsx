import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { ActivityIndicator } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { AllEnvironmentsMaintenanceToolbarActions } from '@/ui/components/all-environments-maintenance';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { EnvironmentToolbarAction } from '@/ui/components/toolbar';

import type { ImagesListModel } from './use-images-list';

export function ImagesToolbar({ model }: { model: ImagesListModel }) {
	const accent = useAccentColor();
	const environments = model.listEnvironments;
	const pruneDisabled = model.allEnvironments && model.isOperationRunning;
	const bulk = model.bulkToolbar;
	const pullEnvironmentID = model.allEnvironments ? environments[0]?.id : model.environmentID;
	return (
		<>
			{model.isAdmin ? (
				<AppToolbar placement="left" tintColor={accent}>
					<Stack.Toolbar.Button
						icon="shippingbox"
						accessibilityLabel="Container Registries"
						onPress={model.openRegistries}
					/>
				</AppToolbar>
			) : null}
			{model.isSelecting ? (
				<AppToolbar placement="right" tintColor={accent}>
					{bulk.active && bulk.primary ? (
						bulk.runningItemID === bulk.primary.id ? (
							<Stack.Toolbar.View>
								<ActivityIndicator accessibilityLabel={bulk.primary.title} />
							</Stack.Toolbar.View>
						) : (
							<Stack.Toolbar.Button
								icon={bulk.primary.systemImage as SFSymbol}
								tintColor={bulk.primary.tint}
								accessibilityLabel={bulk.primary.title}
								disabled={bulk.isDisabled}
								onPress={bulk.primary.action}
							/>
						)
					) : null}
					<Stack.Toolbar.Button onPress={model.exitSelectionMode}>Done</Stack.Toolbar.Button>
				</AppToolbar>
			) : (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Button
						icon={
							model.activeFilterCount > 0
								? 'line.3.horizontal.decrease.circle.fill'
								: 'line.3.horizontal.decrease.circle'
						}
						accessibilityLabel="Filter"
						onPress={model.openFilter}
					/>
					<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="More options">
						<Stack.Toolbar.Menu inline>
							<Stack.Toolbar.MenuAction icon="checklist" onPress={model.enterSelectionMode}>
								Select
							</Stack.Toolbar.MenuAction>
						</Stack.Toolbar.Menu>
						<Stack.Toolbar.Menu inline>
							{model.allEnvironments ? (
								EnvironmentToolbarAction({
									title: 'Updates',
									systemImage: 'arrow.up.arrow.down.circle',
									environments: environments,
									action: model.openUpdates
								})
							) : (
								<Stack.Toolbar.MenuAction
									icon="arrow.up.arrow.down.circle"
									onPress={() => model.openUpdates(model.environmentID)}
								>
									Updates
								</Stack.Toolbar.MenuAction>
							)}
							<Stack.Toolbar.MenuAction icon="shield" onPress={model.openSecurity}>
								Security
							</Stack.Toolbar.MenuAction>
							{EnvironmentToolbarAction({
								title: 'Upload tarball…',
								systemImage: 'square.and.arrow.up',
								environments: environments,
								action: model.presentUpload
							})}
						</Stack.Toolbar.Menu>
						{model.allEnvironments ? (
							<Stack.Toolbar.Menu inline>
								{AllEnvironmentsMaintenanceToolbarActions({
									onSelect: model.selectMaintenance,
									isRunning: model.isOperationRunning
								})}
							</Stack.Toolbar.Menu>
						) : null}
						<Stack.Toolbar.Menu inline>
							<Stack.Toolbar.MenuAction
								icon="trash"
								destructive
								disabled={pruneDisabled}
								onPress={() => model.requestPrune('images')}
							>
								Quick Prune (Dangling)
							</Stack.Toolbar.MenuAction>
							<Stack.Toolbar.MenuAction
								icon="trash"
								destructive
								disabled={pruneDisabled}
								onPress={() => model.requestPrune('unusedImages')}
							>
								Prune All Unused
							</Stack.Toolbar.MenuAction>
							{EnvironmentToolbarAction({
								title: 'Prune Options…',
								systemImage: 'slider.horizontal.3',
								environments: environments,
								action: model.presentPruneOptions
							})}
						</Stack.Toolbar.Menu>
					</Stack.Toolbar.Menu>
					{model.allEnvironments && environmentActionIsMenu(environments) ? (
						<Stack.Toolbar.Menu icon="arrow.down.circle" accessibilityLabel="Pull image">
							{environments.map((environment) => (
								<Stack.Toolbar.MenuAction
									key={environment.id}
									onPress={() => model.presentPull(environment.id)}
								>
									{environmentTitle(environment)}
								</Stack.Toolbar.MenuAction>
							))}
						</Stack.Toolbar.Menu>
					) : pullEnvironmentID !== undefined ? (
						<Stack.Toolbar.Button
							icon="arrow.down.circle"
							accessibilityLabel="Pull image"
							onPress={() => model.presentPull(pullEnvironmentID)}
						/>
					) : null}
				</AppToolbar>
			)}
		</>
	);
}
