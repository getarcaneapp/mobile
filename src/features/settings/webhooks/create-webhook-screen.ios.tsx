import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	Form,
	HStack,
	Label,
	NavigationStack,
	Picker,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	scaleEffect,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { capitalized } from './use-webhooks';
import { useCreateWebhook, type CreateWebhookModel } from './use-create-webhook';
import {
	webhookTargetTypes,
	type WebhookActionType,
	type WebhookTargetType
} from './webhook-models';

function SelectPicker({
	label,
	model,
	options
}: {
	label: string;
	model: CreateWebhookModel;
	options: { label: string; value: string }[];
}) {
	return (
		<Picker
			label={label}
			selection={model.targetId}
			onSelectionChange={(value: string) => model.setTargetId(value)}
		>
			<Text modifiers={[tag('')]}>Select…</Text>
			{options.map((option) => (
				<Text key={option.value} modifiers={[tag(option.value)]}>
					{option.label}
				</Text>
			))}
		</Picker>
	);
}

function TargetPicker({ model }: { model: CreateWebhookModel }) {
	if (model.loadingTargets) {
		return (
			<HStack>
				<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
					Loading targets…
				</Text>
				<Spacer />
				<ProgressView modifiers={[scaleEffect(0.7)]} />
			</HStack>
		);
	}
	switch (model.targetType) {
		case 'container':
			return <SelectPicker label="Container" model={model} options={model.containerOptions} />;
		case 'project':
			return <SelectPicker label="Project" model={model} options={model.projectOptions} />;
		case 'gitops':
			return (
				<FormTextField
					title="Stack ID"
					placeholder="stack-id"
					text={model.targetId}
					onChangeText={model.setTargetId}
					autocapitalization="never"
					autocorrectionDisabled
				/>
			);
		default:
			return null;
	}
}

export function CreateWebhookScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useCreateWebhook();
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Create Webhook'),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<Section
								header={<Text>Webhook Details</Text>}
								footer={<Text>Use a name that explains what this webhook will trigger.</Text>}
							>
								<FormTextField
									title="Name"
									placeholder="Restart API container"
									text={model.name}
									onChangeText={model.setName}
								/>
							</Section>
							<Section title="Target">
								<Picker
									label="Target Type"
									selection={model.targetType}
									onSelectionChange={(value: WebhookTargetType) => model.setTargetType(value)}
								>
									{webhookTargetTypes.map((type) => (
										<Text key={type.value} modifiers={[tag(type.value)]}>
											{type.title}
										</Text>
									))}
								</Picker>
								<Picker
									label="Action"
									selection={model.actionType}
									onSelectionChange={(value: WebhookActionType) => model.setActionType(value)}
								>
									{model.actions.map((action) => (
										<Text key={action} modifiers={[tag(action)]}>
											{capitalized(action)}
										</Text>
									))}
								</Picker>
								{model.needsTargetId ? <TargetPicker model={model} /> : null}
							</Section>
							{model.errorMessage ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Create"
									onPress={model.createWebhook}
									modifiers={[disabled(model.createDisabled), ...toolbarSymbol]}
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
