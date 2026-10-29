import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	NavigationStack,
	Picker,
	ProgressView,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	disabled,
	font,
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	pickerStyle,
	tag,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';

import {
	deploymentFormats,
	useAddEnvironment,
	type AddEnvironmentModel,
	type DeploymentFormat
} from './use-add-environment';

function ErrorSection({ message }: { message: string | undefined }) {
	if (!message) return null;
	return (
		<Section>
			<Label
				title={message}
				systemImage="exclamationmark.triangle"
				modifiers={[foregroundStyle(systemColors.red)]}
			/>
		</Section>
	);
}

function DeploymentSections({ model }: { model: AddEnvironmentModel }) {
	const { phase } = model;
	if (phase.kind !== 'created') return null;
	return (
		<>
			<Section title="Connection">
				{phase.connected ? (
					<Label
						title="Agent connected"
						systemImage="checkmark.circle.fill"
						modifiers={[foregroundStyle(systemColors.green)]}
					/>
				) : (
					<HStack spacing={10}>
						<ProgressView />
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							Waiting for the agent to connect
						</Text>
					</HStack>
				)}
			</Section>
			<ErrorSection message={phase.snippetError} />
			{model.snippetText !== undefined ? (
				<Section title="Run the Agent">
					<Picker
						label="Format"
						selection={model.format}
						onSelectionChange={(value: DeploymentFormat) => model.setFormat(value)}
						modifiers={[pickerStyle('segmented')]}
					>
						{deploymentFormats.map((option) => (
							<Text key={option.value} modifiers={[tag(option.value)]}>
								{option.title}
							</Text>
						))}
					</Picker>
					<Text
						modifiers={[font({ textStyle: 'footnote', design: 'monospaced' }), textSelection(true)]}
					>
						{model.snippetText}
					</Text>
					<Button onPress={model.copySnippet}>
						<Label title="Copy" systemImage="doc.on.doc" />
					</Button>
				</Section>
			) : phase.snippetError ? null : (
				<Section>
					<ProgressView />
				</Section>
			)}
		</>
	);
}

export function AddEnvironmentScreen() {
	const model = useAddEnvironment();
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const created = model.phase.kind === 'created';
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !model.isCreating }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							{created ? (
								<DeploymentSections model={model} />
							) : (
								<>
									<ErrorSection message={model.errorMessage} />
									<Section>
										<FormTextField
											title="Name"
											placeholder="Production"
											text={model.name}
											onChangeText={model.setName}
											autocorrectionDisabled
										/>
									</Section>
								</>
							)}
						</Form>
						<Toolbar.Content>
							{created ? (
								<ToolbarItem placement="confirmationAction">
									<Button label="Done" onPress={model.done} modifiers={toolbarSymbol} />
								</ToolbarItem>
							) : (
								<>
									<ToolbarItem placement="cancellationAction">
										<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
									</ToolbarItem>
									<ToolbarItem placement="confirmationAction">
										<Button
											label="Create"
											onPress={model.create}
											modifiers={[disabled(!model.canCreate), ...toolbarSymbol]}
										/>
									</ToolbarItem>
								</>
							)}
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}
