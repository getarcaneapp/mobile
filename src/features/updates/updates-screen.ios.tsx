/**
 * Port of `UpdatesView` + `EnvironmentPickerSheet` (UpdatesView.swift).
 *
 * iOS: the SwiftUI image updates page, with the Run Updater sheet and the
 * history environment picker as SwiftUI sheets in the same tree.
 */
import {
	BottomSheet,
	Button,
	Group,
	List,
	NavigationStack,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	foregroundStyle,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	presentationDetents,
	presentationDragIndicator
} from '@expo/ui/swift-ui/modifiers';

import { useAccentColor } from '@/theme/accent';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';

import { ImageUpdatesView } from './image-updates-view';
import { EnvironmentPickerRow, UpdaterRunSheet } from './updater-run';
import { PickerMode, useUpdatesScreen } from './use-updates-screen';

export function UpdatesScreen() {
	const model = useUpdatesScreen();
	const accent = useAccentColor();
	const mode = model.pickerMode;

	const sheets = (
		<>
			<BottomSheet
				isPresented={model.showsUpdaterSheet}
				onIsPresentedChange={model.setShowsUpdaterSheet}
			>
				<UpdaterRunSheet
					environments={model.presentedEnvironments}
					initialEnvironmentID={model.initialUpdaterEnvironmentID}
					onDismiss={() => model.setShowsUpdaterSheet(false)}
				/>
			</BottomSheet>
			<BottomSheet
				isPresented={mode !== undefined}
				onIsPresentedChange={(presented) => {
					if (!presented) model.setPickerMode(undefined);
				}}
				onDismiss={model.pickerDidDismiss}
			>
				<Group
					modifiers={[
						presentationDetents(['medium', 'large']),
						presentationDragIndicator('visible')
					]}
				>
					<NavigationStack>
						<Toolbar>
							<List
								modifiers={[
									listStyle('insetGrouped'),
									navigationTitle(PickerMode.title(mode ?? 'history')),
									navigationBarTitleDisplayMode('inline')
								]}
							>
								<Section
									footer={
										<Text>{`Pick an environment to ${mode === 'runUpdater' ? 'run the updater on' : 'view history for'}.`}</Text>
									}
								>
									{model.presentedEnvironments.map((environment) => (
										<EnvironmentPickerRow
											key={environment.id}
											environment={environment}
											onPress={() => model.pickEnvironment(environment)}
										/>
									))}
								</Section>
							</List>
							<Toolbar.Content>
								<ToolbarItem placement="cancellationAction">
									<Button
										label="Cancel"
										onPress={() => model.setPickerMode(undefined)}
										modifiers={[foregroundStyle(accent)]}
									/>
								</ToolbarItem>
							</Toolbar.Content>
						</Toolbar>
					</NavigationStack>
				</Group>
			</BottomSheet>
		</>
	);

	return (
		<>
			<ResourceActionsToolbar
				primary={model.runUpdaterItem}
				secondary={[model.historyItem]}
				active={!model.allEnvironmentsPreview}
			/>
			<ImageUpdatesView historyAction={model.historyItem} sheets={sheets} />
		</>
	);
}
