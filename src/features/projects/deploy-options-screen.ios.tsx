import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	NavigationStack,
	Picker,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import { navigationBarTitleDisplayMode, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import {
	DeleteConfirmationHost,
	singleActionConfig,
	useDeleteConfirmation
} from '@/ui/components/delete-confirmation';

import { pullPolicyOptions } from './project-model';
import { deployOptionsConfirmationHost, useDeployOptions } from './use-deploy-options';

export function DeployOptionsScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
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
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Deploy Options'),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section title="Image Pull Policy">
								<Picker
									label="Pull Images"
									selection={model.pullPolicy}
									onSelectionChange={(value: string) => model.setPullPolicy(value)}
								>
									{pullPolicyOptions.map((option) => (
										<Text key={option.value} modifiers={[tag(option.value)]}>
											{option.title}
										</Text>
									))}
								</Picker>
							</Section>
							<Section
								header={<Text>Container Recreation</Text>}
								footer={<Text>Recreating volumes permanently deletes their current data.</Text>}
							>
								<Toggle
									label="Force Recreation"
									isOn={model.forceRecreate}
									onIsOnChange={model.setForceRecreate}
								/>
								<Toggle
									label="Recreate Volumes"
									isOn={model.recreateVolumes}
									onIsOnChange={model.setRecreateVolumes}
								/>
							</Section>
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button label="Deploy" onPress={model.deploy} modifiers={toolbarSymbol} />
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<DeleteConfirmationHost hostID={deployOptionsConfirmationHost} />
		</View>
	);
}
