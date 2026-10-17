import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	NavigationStack,
	Picker,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import { disabled, navigationTitle, tag } from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ToastHost } from '@/ui/toast';

import { BackupDestinationPicker } from './backup-destination-picker';
import { useBackupCreate } from './use-backup-create';

export function VolumeBackupCreateScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const model = useBackupCreate(token);
	if (!model) return null;
	const { state } = model;
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form modifiers={[navigationTitle('Create Backup')]}>
							<Picker
								label="Storage"
								selection={state.destination}
								onSelectionChange={(value: string) => state.setDestination(value)}
							>
								<Text modifiers={[tag('local')]}>Local</Text>
								{state.supportsPolicies ? <Text modifiers={[tag('s3')]}>S3</Text> : null}
								{state.supportsPolicies ? (
									<Text modifiers={[tag('local_s3')]}>Local and S3</Text>
								) : null}
							</Picker>
							{state.destination !== 'local' ? (
								<BackupDestinationPicker
									selection={state.s3ID}
									onSelectionChange={state.setS3ID}
									destinations={state.destinations}
								/>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={() => router.back()} modifiers={toolbarSymbol} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Create"
									onPress={model.create}
									modifiers={[disabled(!model.canCreate), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
