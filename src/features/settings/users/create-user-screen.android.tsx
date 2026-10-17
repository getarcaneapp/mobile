/** Android rendering of `CreateUserView` (CreateUserView.swift). Presented as a modal. */
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormPicker, FormSecureField, FormTextField } from '@/ui/components/form-fields';

import { roleDisplayName } from '../rbac/rbac-models';
import { M3Section, SwitchRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { FormErrorSection } from '../shared/form-error-section';

import { useCreateUser } from './use-create-user';

export function CreateUserScreen() {
	const model = useCreateUser();
	return (
		<>
			<Stack.Screen options={{ title: 'Create User' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'create',
						icon: 'checkmark',
						label: 'Create',
						disabled: !model.canCreate,
						onPress: model.create
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Credentials">
					<FormTextField
						title="Username"
						placeholder="Required"
						text={model.username}
						onChangeText={model.setUsername}
						autocapitalization="never"
						autocorrectionDisabled
					/>
					<FormSecureField
						title="Password"
						placeholder="Required"
						text={model.password}
						onChangeText={model.setPassword}
					/>
				</M3Section>
				<M3Section title="Profile">
					<FormTextField
						title="Email"
						placeholder="Optional"
						text={model.email}
						onChangeText={model.setEmail}
						keyboardType="email-address"
						autocapitalization="never"
						autocorrectionDisabled
					/>
				</M3Section>
				<M3Section
					title="Roles"
					footer={
						model.supportsRoleManagement
							? 'The selected role is assigned globally. Per-environment assignments can be edited after creation.'
							: undefined
					}
				>
					{model.supportsRoleManagement ? (
						model.isLoadingRoles && model.availableRoles.length === 0 ? (
							<View style={{ padding: 16, alignItems: 'center' }}>
								<ArcaneLoadingView label="Loading roles…" variant="inline" />
							</View>
						) : (
							<FormPicker
								title="Role"
								selection={model.selectedRoleId}
								onSelectionChange={model.setSelectedRoleId}
								options={[
									{ label: 'Choose…', value: '' },
									...model.availableRoles.map((role) => ({
										label: roleDisplayName(role),
										value: role.id
									}))
								]}
							/>
						)
					) : (
						<SwitchRow
							title="Administrator"
							value={model.isAdmin}
							onValueChange={model.setIsAdmin}
						/>
					)}
				</M3Section>
				<FormErrorSection message={model.errorMessage} />
			</ScrollView>
		</>
	);
}
