/** Port of `DeleteVariableView` (VariablesView.swift). Presented as a medium sheet. */
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ToastHost } from '@/ui/toast';

import { useDeleteVariable } from './use-delete-variable';

export function DeleteVariableScreen() {
	const model = useDeleteVariable();
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen options={{ gestureEnabled: !model.isDeleting }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Delete Variable'),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section footer={<Text>This action cannot be undone.</Text>}>
								<Label
									title={model.prompt}
									systemImage="exclamationmark.triangle.fill"
									modifiers={[foregroundStyle(systemColors.orange)]}
								/>
							</Section>
							{model.errorMessage !== undefined ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isDeleting)]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Delete"
									role="destructive"
									onPress={() => void model.remove()}
									modifiers={[foregroundStyle(systemColors.red), disabled(model.isDeleting)]}
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
