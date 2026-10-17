/** Port of `OIDCMappingFormSheet` (OIDCRoleMappingsView.swift). Presented as a sheet. */
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	NavigationStack,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import { navigationBarTitleDisplayMode, navigationTitle } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { FormErrorSection } from '../shared/form-error-section';
import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';

import { RolePicker, ScopeSection } from './scope-pickers';
import { useOIDCMappingForm } from './use-oidc-mapping-form';

export function OIDCMappingFormScreen() {
	const model = useOIDCMappingForm();
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							<Section
								header={<Text>Claim Value</Text>}
								footer={<Text>Enter the exact value from the configured OIDC claim.</Text>}
							>
								<FormTextField
									title="Claim Value"
									placeholder="docker-admins"
									text={model.claimValue}
									onChangeText={model.setClaimValue}
									autocapitalization="never"
									autocorrectionDisabled
								/>
							</Section>
							<Section title="Role">
								<RolePicker
									roles={model.availableRoles}
									selection={model.roleId}
									onSelectionChange={model.setRoleId}
								/>
							</Section>
							<ScopeSection
								scope={model.scope}
								onScopeChange={model.setScope}
								environments={model.availableEnvironments}
								environmentId={model.environmentId}
								onEnvironmentChange={model.setEnvironmentId}
								globalFooter="Global mappings apply across every environment."
								environmentFooter="Environment mappings only apply inside the selected environment."
							/>
							<FormErrorSection message={model.errorMessage} />
							<SettingsSaveBarSpacer />
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<SettingsSaveBar
				reservesTabBarSpace={false}
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.canSave}
				onSave={model.save}
				onRevert={model.revertChanges}
			/>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
