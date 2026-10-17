/**
 * Android rendering of `UpdatesView` + `EnvironmentPickerSheet`
 * (UpdatesView.swift): the image updates page with Run Updater / Updater
 * History in the top app bar and Material bottom sheets.
 */
import { Text, View } from 'react-native';

import { AndroidResourceActionsToolbar } from '@/features/containers/android-toolbar';
import { MaterialSheet } from '@/features/dashboard/components/material-sheet';
import { colors } from '@/theme/colors';
import { m3Type } from '@/ui/components/type-scale';
import { MaterialListGroup } from '@/ui/material/list';

import { SheetHeader } from './android-sheet-header';
import { ImageUpdatesView } from './image-updates-view';
import { EnvironmentPickerRow, UpdaterRunSheet } from './updater-run';
import { PickerMode, useUpdatesScreen } from './use-updates-screen';

export function UpdatesScreen() {
	const model = useUpdatesScreen();
	const mode = model.pickerMode;

	const sheets = (
		<>
			<MaterialSheet
				isPresented={model.showsUpdaterSheet}
				onDismiss={() => model.setShowsUpdaterSheet(false)}
			>
				<UpdaterRunSheet
					environments={model.presentedEnvironments}
					initialEnvironmentID={model.initialUpdaterEnvironmentID}
					onDismiss={() => model.setShowsUpdaterSheet(false)}
				/>
			</MaterialSheet>
			<MaterialSheet
				isPresented={mode !== undefined}
				onDismiss={() => {
					model.setPickerMode(undefined);
					model.pickerDidDismiss();
				}}
			>
				<View style={{ paddingBottom: 24 }}>
					<SheetHeader
						title={PickerMode.title(mode ?? 'history')}
						actionTitle="Cancel"
						onAction={() => model.setPickerMode(undefined)}
					/>
					<MaterialListGroup>
						{model.presentedEnvironments.map((environment) => (
							<EnvironmentPickerRow
								key={environment.id}
								environment={environment}
								onPress={() => {
									model.pickEnvironment(environment);
									model.pickerDidDismiss();
								}}
							/>
						))}
					</MaterialListGroup>
					<Text
						style={[
							m3Type.bodySmall,
							{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
						]}
					>
						{`Pick an environment to ${mode === 'runUpdater' ? 'run the updater on' : 'view history for'}.`}
					</Text>
				</View>
			</MaterialSheet>
		</>
	);

	return (
		<>
			{!model.allEnvironmentsPreview ? (
				<AndroidResourceActionsToolbar
					primary={model.runUpdaterItem}
					secondary={[model.historyItem]}
				/>
			) : null}
			<ImageUpdatesView historyAction={model.historyItem} sheets={sheets} />
		</>
	);
}
