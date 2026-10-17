import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	Section,
	Toggle,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';

import { useTemplateRegistryForm } from './use-template-registry-form';

export function TemplateRegistryFormScreen() {
	const model = useTemplateRegistryForm();
	const { draft, update } = model;

	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							<Section title="Template Registry">
								<FormTextField
									title="Name"
									placeholder="Company templates"
									text={draft.name}
									onChangeText={(name) => update({ name })}
								/>
								<FormTextField
									title="URL"
									placeholder="https://example.com/templates.json"
									text={draft.url}
									onChangeText={(url) => update({ url })}
									keyboardType="url"
									textContentType="URL"
									autocapitalization="never"
									autocorrectionDisabled
								/>
								<FormTextField
									title="Description"
									placeholder="Optional"
									text={draft.description}
									onChangeText={(description) => update({ description })}
									axis="vertical"
									lineLimit={{ min: 2, max: 4 }}
								/>
								<Toggle
									label="Enabled"
									isOn={draft.enabled}
									onIsOnChange={(enabled) => update({ enabled })}
								/>
							</Section>
							{model.errorMessage !== undefined ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
								</Section>
							) : null}
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
				hasChanges={model.hasChanges}
				isSaving={model.isLoading}
				canSave={model.canSave}
				saveAccessibilityLabel={model.saveAccessibilityLabel}
				onSave={model.save}
				onRevert={model.revertChanges}
				reservesTabBarSpace={false}
			/>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
