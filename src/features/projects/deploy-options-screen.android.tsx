/** Android rendering of `DeployOptionsSheet` (ProjectDetailView.swift). */
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import {
	DeleteConfirmationHost,
	singleActionConfig,
	useDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import { FormPicker } from '@/ui/components/form-fields';

import { M3Section, SwitchRow } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';

import { pullPolicyOptions } from './project-model';
import { deployOptionsConfirmationHost, useDeployOptions } from './use-deploy-options';

export function DeployOptionsScreen() {
	const model = useDeployOptions();

	useDeleteConfirmation(
		model.showsVolumeWarning,
		model.setShowsVolumeWarning,
		singleActionConfig({
			title: 'Recreate Volumes?',
			message: 'Existing project volume data will be permanently lost.',
			confirmTitle: 'Deploy and Delete Volume Data',
			dismissOnConfirm: false,
			onConfirm: model.beginDeploy
		}),
		deployOptionsConfirmationHost
	);

	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ title: 'Deploy Options' }} />
			<AndroidToolbar
				placement="left"
				items={[
					{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
				]}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'deploy',
						icon: 'play.fill',
						label: 'Deploy',
						onPress: model.deploy
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section title="Image Pull Policy">
					<FormPicker
						title="Pull Images"
						selection={model.pullPolicy}
						onSelectionChange={model.setPullPolicy}
						options={pullPolicyOptions.map((option) => ({
							label: option.title,
							value: option.value
						}))}
					/>
				</M3Section>
				<M3Section
					title="Container Recreation"
					footer="Recreating volumes permanently deletes their current data."
				>
					<SwitchRow
						title="Force Recreation"
						value={model.forceRecreate}
						onValueChange={model.setForceRecreate}
					/>
					<SwitchRow
						title="Recreate Volumes"
						value={model.recreateVolumes}
						onValueChange={model.setRecreateVolumes}
					/>
				</M3Section>
			</ScrollView>
			<DeleteConfirmationHost hostID={deployOptionsConfirmationHost} />
		</View>
	);
}
