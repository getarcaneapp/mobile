import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';

import { M3Section } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { FormErrorSection } from '../shared/form-error-section';

import { RolePicker, ScopeSection } from './scope-pickers';
import { useAddRoleAssignment } from './use-add-role-assignment';

export function AddRoleAssignmentScreen() {
	const model = useAddRoleAssignment();
	return (
		<>
			<Stack.Screen options={{ title: 'Add Assignment' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'add',
						icon: 'checkmark',
						label: 'Add',
						disabled: !model.canSave,
						onPress: model.save
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section title="Role">
					<RolePicker
						roles={model.availableRoles}
						selection={model.selectedRoleId}
						onSelectionChange={model.setSelectedRoleId}
					/>
				</M3Section>
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
			</ScrollView>
		</>
	);
}
