/** Port of `SwarmServiceEditorView` (SwarmServiceEditorView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	LabeledContent,
	List,
	NavigationStack,
	Picker,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	autocorrectionDisabled,
	disabled,
	fixedSize,
	font,
	foregroundStyle,
	keyboardType,
	labelsHidden,
	monospacedDigit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	pickerStyle,
	tag,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';

import { BoundTextField } from '@/features/containers/swiftui-text-field';

import type { SwarmServiceMode } from './swarm-spec-draft';
import { ReplicaStepper } from './swarm-services-view';
import {
	useSwarmServiceEditor,
	type PairsField,
	type SwarmServiceEditorModel
} from './use-swarm-service-editor';

const plainField = [textInputAutocapitalization('never'), autocorrectionDisabled()];
const monoField = [...plainField, font({ textStyle: 'body', design: 'monospaced' })];

function PairsSection({
	model,
	title,
	field,
	keyPlaceholder,
	addTitle
}: {
	model: SwarmServiceEditorModel;
	title: string;
	field: PairsField;
	keyPlaceholder: string;
	addTitle: string;
}) {
	return (
		<Section title={title}>
			<List.ForEach onDelete={(indices) => model.removeAt(field, indices)}>
				{model.draft[field].map((pair) => (
					<HStack key={pair.id} spacing={8}>
						<BoundTextField
							placeholder={keyPlaceholder}
							value={pair.key}
							onChangeText={(key) => model.updatePair(field, pair.id, { key })}
							modifiers={monoField}
						/>
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							=
						</Text>
						<BoundTextField
							placeholder="value"
							value={pair.value}
							onChangeText={(value) => model.updatePair(field, pair.id, { value })}
							modifiers={monoField}
						/>
					</HStack>
				))}
			</List.ForEach>
			<Button onPress={() => model.addPair(field)}>
				<Label title={addTitle} systemImage="plus" />
			</Button>
		</Section>
	);
}

export function SwarmServiceEditorScreen() {
	const model = useSwarmServiceEditor();
	const { draft } = model;
	const numberField = [keyboardType('numeric'), font({ textStyle: 'body' }), monospacedDigit()];
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !(model.isSaving || model.hasChanges) }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							<Section title="Service">
								<FormTextField
									title="Name"
									placeholder="web"
									text={draft.name}
									onChangeText={(name) => model.update({ name })}
									autocapitalization="never"
									autocorrectionDisabled
									helper={model.isEditing ? "Docker can't rename a service." : undefined}
									disabled={model.isEditing}
								/>
								<FormTextField
									title="Image"
									placeholder="nginx:latest"
									text={draft.image}
									onChangeText={(image) => model.update({ image })}
									autocapitalization="never"
									autocorrectionDisabled
								/>
							</Section>
							<Section title="Scheduling">
								{draft.mode === 'job' ? (
									<LabeledContent label="Mode">
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											Job
										</Text>
									</LabeledContent>
								) : (
									<>
										<Picker
											label="Mode"
											selection={draft.mode}
											onSelectionChange={(mode: SwarmServiceMode) => model.update({ mode })}
											modifiers={[disabled(model.isEditing)]}
										>
											<Text modifiers={[tag('replicated')]}>Replicated</Text>
											<Text modifiers={[tag('global')]}>Global</Text>
										</Picker>
										{draft.mode === 'replicated' ? (
											<ReplicaStepper
												value={draft.replicas}
												onValueChange={(replicas) =>
													model.update({ replicas: Math.min(Math.max(replicas, 0), 1000) })
												}
											/>
										) : null}
									</>
								)}
							</Section>
							<Section title="Ports">
								<List.ForEach onDelete={(indices) => model.removeAt('ports', indices)}>
									{draft.ports.map((port) => (
										<HStack key={port.id} spacing={8}>
											<BoundTextField
												placeholder="Published"
												value={port.published}
												onChangeText={(published) => model.updatePort(port.id, { published })}
												modifiers={numberField}
											/>
											<Image
												systemName="arrow.right"
												modifiers={[
													foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
													accessibilityHidden(true)
												]}
											/>
											<BoundTextField
												placeholder="Target"
												value={port.target}
												onChangeText={(target) => model.updatePort(port.id, { target })}
												modifiers={numberField}
											/>
											<Picker
												label="Protocol"
												selection={port.proto}
												onSelectionChange={(proto: string) => model.updatePort(port.id, { proto })}
												modifiers={[labelsHidden(), fixedSize()]}
											>
												<Text modifiers={[tag('tcp')]}>TCP</Text>
												<Text modifiers={[tag('udp')]}>UDP</Text>
											</Picker>
										</HStack>
									))}
								</List.ForEach>
								<Button onPress={model.addPort}>
									<Label title="Add Port" systemImage="plus" />
								</Button>
							</Section>
							<PairsSection
								model={model}
								title="Environment"
								field="env"
								keyPlaceholder="KEY"
								addTitle="Add Variable"
							/>
							<Section title="Mounts">
								<List.ForEach onDelete={(indices) => model.removeAt('mounts', indices)}>
									{draft.mounts.map((mount) => (
										<VStack
											key={mount.id}
											alignment="leading"
											spacing={8}
											modifiers={[padding({ vertical: 4 })]}
										>
											<Picker
												label="Type"
												selection={mount.type}
												onSelectionChange={(type: string) => model.updateMount(mount.id, { type })}
												modifiers={[pickerStyle('segmented')]}
											>
												<Text modifiers={[tag('volume')]}>Volume</Text>
												<Text modifiers={[tag('bind')]}>Bind</Text>
												<Text modifiers={[tag('tmpfs')]}>tmpfs</Text>
											</Picker>
											{mount.type !== 'tmpfs' ? (
												<BoundTextField
													placeholder={mount.type === 'bind' ? 'Host path' : 'Volume name'}
													value={mount.source}
													onChangeText={(source) => model.updateMount(mount.id, { source })}
													modifiers={plainField}
												/>
											) : null}
											<BoundTextField
												placeholder="Container path"
												value={mount.target}
												onChangeText={(target) => model.updateMount(mount.id, { target })}
												modifiers={plainField}
											/>
											<Toggle
												label="Read-only"
												isOn={mount.readOnly}
												onIsOnChange={(readOnly) => model.updateMount(mount.id, { readOnly })}
											/>
										</VStack>
									))}
								</List.ForEach>
								<Button onPress={model.addMount}>
									<Label title="Add Mount" systemImage="plus" />
								</Button>
							</Section>
							<PairsSection
								model={model}
								title="Labels"
								field="labels"
								keyPlaceholder="com.example.key"
								addTitle="Add Label"
							/>
							<Section
								header={<Text>Advanced</Text>}
								footer={
									<Text>Separate arguments with spaces; quote values that contain spaces.</Text>
								}
							>
								<FormTextField
									title="Command"
									placeholder="Image default"
									text={draft.command}
									onChangeText={(command) => model.update({ command })}
									autocapitalization="never"
									autocorrectionDisabled
									monospaced
								/>
								<FormTextField
									title="Args"
									placeholder="None"
									text={draft.args}
									onChangeText={(args) => model.update({ args })}
									autocapitalization="never"
									autocorrectionDisabled
									monospaced
								/>
								<FormTextField
									title="Working Dir"
									placeholder="Image default"
									text={draft.workingDir}
									onChangeText={(workingDir) => model.update({ workingDir })}
									autocapitalization="never"
									autocorrectionDisabled
								/>
								<FormTextField
									title="User"
									placeholder="Image default"
									text={draft.user}
									onChangeText={(user) => model.update({ user })}
									autocapitalization="never"
									autocorrectionDisabled
								/>
								<FormTextField
									title="Hostname"
									placeholder="Automatic"
									text={draft.hostname}
									onChangeText={(hostname) => model.update({ hostname })}
									autocapitalization="never"
									autocorrectionDisabled
								/>
							</Section>
							{model.errorMessage ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isSaving)]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label={model.saveTitle}
									onPress={model.save}
									modifiers={[disabled(!model.canSave)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}
