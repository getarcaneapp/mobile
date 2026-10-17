/** Port of `AddRoleAssignmentSheet` (UserRoleAssignmentsView.swift). Presented as a sheet. */
import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Button, Form, NavigationStack, Section, Toolbar, ToolbarItem } from '@expo/ui/swift-ui';
import {
	disabled,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { ToastHost } from '@/ui/toast';

import { FormErrorSection } from '../shared/form-error-section';

import { RolePicker, ScopeSection } from './scope-pickers';
import { useAddRoleAssignment } from './use-add-role-assignment';

export function AddRoleAssignmentScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useAddRoleAssignment();
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Add Assignment'),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section title="Role">
								<RolePicker
									roles={model.availableRoles}
									selection={model.selectedRoleId}
									onSelectionChange={model.setSelectedRoleId}
								/>
							</Section>
							<ScopeSection
								scope={model.scope}
								onScopeChange={model.setScope}
								environments={model.availableEnvironments}
								environmentId={model.selectedEnvironmentId}
								onEnvironmentChange={model.setSelectedEnvironmentId}
								globalFooter="Global assignments apply across every environment."
								environmentFooter="Environment assignments only apply inside the selected environment."
							/>
							<FormErrorSection message={model.errorMessage} />
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Add"
									onPress={model.save}
									modifiers={[disabled(!model.canSave), ...toolbarSymbol]}
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
