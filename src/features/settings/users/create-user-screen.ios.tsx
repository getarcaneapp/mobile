/** Port of `CreateUserView` (CreateUserView.swift). Presented as a sheet. */
import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
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
import {
	disabled,
	navigationBarTitleDisplayMode,
	navigationTitle,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { roleDisplayName } from '../rbac/rbac-models';
import { FormErrorSection } from '../shared/form-error-section';

import { useCreateUser, type CreateUserModel } from './use-create-user';

function RolesSection({ model }: { model: CreateUserModel }) {
	return (
		<Section
			header={<Text>Roles</Text>}
			footer={
				model.supportsRoleManagement ? (
					<Text>
						The selected role is assigned globally. Per-environment assignments can be edited after
						creation.
					</Text>
				) : undefined
			}
		>
			{model.supportsRoleManagement ? (
				model.isLoadingRoles && model.availableRoles.length === 0 ? (
					<ArcaneLoadingViewSwiftUI label="Loading roles…" />
				) : (
					<Picker
						label="Role"
						selection={model.selectedRoleId}
						onSelectionChange={model.setSelectedRoleId}
					>
						<Text modifiers={[tag('')]}>Choose…</Text>
						{model.availableRoles.map((role) => (
							<Text key={role.id} modifiers={[tag(role.id)]}>
								{roleDisplayName(role)}
							</Text>
						))}
					</Picker>
				)
			) : (
				<Toggle label="Administrator" isOn={model.isAdmin} onIsOnChange={model.setIsAdmin} />
			)}
		</Section>
	);
}

export function CreateUserScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useCreateUser();
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle('Create User'), navigationBarTitleDisplayMode('inline')]}
						>
							<Section title="Credentials">
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
							</Section>
							<Section title="Profile">
								<FormTextField
									title="Email"
									placeholder="Optional"
									text={model.email}
									onChangeText={model.setEmail}
									keyboardType="email-address"
									autocapitalization="never"
									autocorrectionDisabled
								/>
							</Section>
							<RolesSection model={model} />
							<FormErrorSection message={model.errorMessage} />
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
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
