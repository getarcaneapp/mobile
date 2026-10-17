import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	Form,
	LabeledContent,
	NavigationStack,
	Picker,
	Section,
	Text,
	Toggle,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	disabled,
	font,
	foregroundStyle,
	keyboardType,
	lineLimit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	privacySensitive,
	tag,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ToastHost } from '@/ui/toast';

import type { ContainerConfigurationDraft } from './container-configuration-draft';
import { BoundTextField } from './swiftui-text-field';
import {
	useContainerConfiguration,
	type ContainerConfigurationModel
} from './use-container-configuration';

const multilineModifiers = [lineLimit(8), font({ textStyle: 'body', design: 'monospaced' })];

function Field({
	label,
	value,
	onChange,
	keyboard
}: {
	label: string;
	value: string;
	onChange: (text: string) => void;
	keyboard?: 'numeric' | 'numbers-and-punctuation';
}) {
	return (
		<BoundTextField
			placeholder={label}
			value={value}
			onChangeText={onChange}
			modifiers={keyboard ? [keyboardType(keyboard)] : undefined}
		/>
	);
}

function Multiline({
	label,
	value,
	onChange,
	sensitive
}: {
	label: string;
	value: string;
	onChange: (text: string) => void;
	sensitive?: boolean;
}) {
	return (
		<BoundTextField
			placeholder={label}
			value={value}
			onChangeText={onChange}
			axis="vertical"
			modifiers={[...multilineModifiers, ...(sensitive ? [privacySensitive()] : [])]}
		/>
	);
}

function NumberField({
	label,
	value,
	onChange
}: {
	label: string;
	value: string;
	onChange: (text: string) => void;
}) {
	return (
		<VStack alignment="leading">
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{label}
			</Text>
			<Field label={label} value={value} onChange={onChange} keyboard="numbers-and-punctuation" />
		</VStack>
	);
}

function ConfigurationSections({ model }: { model: ContainerConfigurationModel }) {
	const { draft, update } = model;
	const set = (key: keyof ContainerConfigurationDraft) => (text: string) =>
		update({ [key]: text } as Partial<ContainerConfigurationDraft>);
	const sectionModifiers = model.review ? [disabled(true)] : [];
	return (
		<>
			<Section title="Container" modifiers={sectionModifiers}>
				<Field label="Name" value={draft.name} onChange={set('name')} />
				<Field label="Image" value={draft.image} onChange={set('image')} />
				<Field label="Working directory" value={draft.workingDir} onChange={set('workingDir')} />
				<Field label="User" value={draft.user} onChange={set('user')} />
			</Section>
			<Section title="Command" modifiers={sectionModifiers}>
				<Multiline
					label="Command arguments, one per line"
					value={draft.command}
					onChange={set('command')}
				/>
				<Multiline
					label="Entrypoint arguments, one per line"
					value={draft.entrypoint}
					onChange={set('entrypoint')}
				/>
			</Section>
			<Section title="Environment variables" modifiers={sectionModifiers}>
				<Multiline
					label="NAME=value, one per line"
					value={draft.environment}
					onChange={set('environment')}
					sensitive
				/>
			</Section>
			<Section title="Ports" modifiers={sectionModifiers}>
				{draft.ports.map((port) => (
					<VStack key={port.id} alignment="leading">
						<Field
							label="Container port (80/tcp)"
							value={port.port}
							onChange={(text) => model.updatePort(port.id, { port: text })}
						/>
						<Field
							label="Host address (optional)"
							value={port.hostIP}
							onChange={(text) => model.updatePort(port.id, { hostIP: text })}
						/>
						<Field
							label="Host port (blank for automatic)"
							value={port.hostPort}
							onChange={(text) => model.updatePort(port.id, { hostPort: text })}
							keyboard="numeric"
						/>
						<Button
							label="Remove port"
							role="destructive"
							onPress={() => model.removeItem('ports', port.id)}
						/>
					</VStack>
				))}
				<Button label="Add port" onPress={model.addPort} />
			</Section>
			<Section title="Mounts" modifiers={sectionModifiers}>
				{draft.mounts.map((mount) => (
					<VStack key={mount.id} alignment="leading">
						<Picker
							label="Type"
							selection={mount.type}
							onSelectionChange={(value: string) => model.updateMount(mount.id, { type: value })}
						>
							<Text modifiers={[tag('volume')]}>Volume</Text>
							<Text modifiers={[tag('bind')]}>Bind mount</Text>
						</Picker>
						<Field
							label="Source volume or host path"
							value={mount.source}
							onChange={(text) => model.updateMount(mount.id, { source: text })}
						/>
						<Field
							label="Container path"
							value={mount.target}
							onChange={(text) => model.updateMount(mount.id, { target: text })}
						/>
						<Toggle
							label="Read only"
							isOn={mount.readOnly}
							onIsOnChange={(isOn) => model.updateMount(mount.id, { readOnly: isOn })}
						/>
						<Button
							label="Remove mount"
							role="destructive"
							onPress={() => model.removeItem('mounts', mount.id)}
						/>
					</VStack>
				))}
				<Button label="Add mount" onPress={model.addMount} />
				{draft.binds !== '' ? (
					<Multiline
						label="Existing volume bindings, one per line"
						value={draft.binds}
						onChange={set('binds')}
					/>
				) : null}
			</Section>
			<Section title="Networks" modifiers={sectionModifiers}>
				{model.preservesNetworkMode ? (
					<>
						<LabeledContent label="Network mode">
							<Text>{model.networkMode ?? ''}</Text>
						</LabeledContent>
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							This container's network mode is preserved.
						</Text>
					</>
				) : (
					<>
						{draft.networks.map((network) => (
							<VStack key={network.id} alignment="leading">
								<Field
									label="Network name"
									value={network.name}
									onChange={(text) => model.updateNetwork(network.id, { name: text })}
								/>
								<Multiline
									label="Aliases, one per line"
									value={network.aliases}
									onChange={(text) => model.updateNetwork(network.id, { aliases: text })}
								/>
								<Field
									label="Static IPv4 address (optional)"
									value={network.ipv4}
									onChange={(text) => model.updateNetwork(network.id, { ipv4: text })}
								/>
								<Field
									label="Static IPv6 address (optional)"
									value={network.ipv6}
									onChange={(text) => model.updateNetwork(network.id, { ipv6: text })}
								/>
								<Button
									label="Remove network"
									role="destructive"
									onPress={() => model.removeItem('networks', network.id)}
								/>
							</VStack>
						))}
						<Button label="Add network" onPress={model.addNetwork} />
					</>
				)}
			</Section>
			<Section title="Restart policy" modifiers={sectionModifiers}>
				<Picker
					label="Policy"
					selection={draft.restartPolicy}
					onSelectionChange={(value: string) => update({ restartPolicy: value })}
				>
					<Text modifiers={[tag('no')]}>Never</Text>
					<Text modifiers={[tag('always')]}>Always</Text>
					<Text modifiers={[tag('unless-stopped')]}>Unless stopped</Text>
					<Text modifiers={[tag('on-failure')]}>On failure</Text>
				</Picker>
				{draft.restartPolicy === 'on-failure' ? (
					<Field
						label="Maximum retries"
						value={draft.retryCount}
						onChange={set('retryCount')}
						keyboard="numeric"
					/>
				) : null}
				<Toggle
					label="Remove when stopped"
					isOn={draft.autoRemove}
					onIsOnChange={(isOn) => update({ autoRemove: isOn })}
				/>
			</Section>
			<Section title="Health check" modifiers={sectionModifiers}>
				<Picker
					label="Health check"
					selection={draft.healthMode}
					onSelectionChange={(value: ContainerConfigurationDraft['healthMode']) =>
						update({ healthMode: value })
					}
				>
					<Text modifiers={[tag('inherit')]}>Use image default</Text>
					<Text modifiers={[tag('disabled')]}>Disabled</Text>
					<Text modifiers={[tag('custom')]}>Custom</Text>
				</Picker>
				{draft.healthMode === 'custom' ? (
					<>
						<Multiline
							label="CMD or CMD-SHELL, then arguments on separate lines"
							value={draft.healthCommand}
							onChange={set('healthCommand')}
						/>
						<NumberField
							label="Interval (seconds)"
							value={draft.interval}
							onChange={set('interval')}
						/>
						<NumberField
							label="Timeout (seconds)"
							value={draft.timeout}
							onChange={set('timeout')}
						/>
						<NumberField
							label="Start period (seconds)"
							value={draft.startPeriod}
							onChange={set('startPeriod')}
						/>
						<NumberField
							label="Start interval (seconds)"
							value={draft.startInterval}
							onChange={set('startInterval')}
						/>
						<NumberField label="Retries" value={draft.retries} onChange={set('retries')} />
					</>
				) : null}
			</Section>
			<Section title="Advanced runtime" modifiers={sectionModifiers}>
				<Toggle
					label="Privileged"
					isOn={draft.privileged}
					onIsOnChange={(isOn) => update({ privileged: isOn })}
				/>
				<Toggle
					label="Read-only root filesystem"
					isOn={draft.readOnly}
					onIsOnChange={(isOn) => update({ readOnly: isOn })}
				/>
				<NumberField
					label="Memory limit (bytes, 0 for unlimited)"
					value={draft.memory}
					onChange={set('memory')}
				/>
				<NumberField
					label="Memory and swap (bytes, -1 for unlimited)"
					value={draft.memorySwap}
					onChange={set('memorySwap')}
				/>
				<NumberField
					label="CPU allocation (billionths of a CPU)"
					value={draft.nanoCPUs}
					onChange={set('nanoCPUs')}
				/>
				<NumberField label="CPU shares" value={draft.cpuShares} onChange={set('cpuShares')} />
				<Multiline
					label="Added capabilities, one per line"
					value={draft.capAdd}
					onChange={set('capAdd')}
				/>
				<Multiline
					label="Dropped capabilities, one per line"
					value={draft.capDrop}
					onChange={set('capDrop')}
				/>
				<Multiline
					label="Labels: name=value, one per line"
					value={draft.labels}
					onChange={set('labels')}
				/>
			</Section>
		</>
	);
}

export function ContainerConfigurationScreen() {
	const toolbarAccent = useAppAccentToolbarSymbol();
	const model = useContainerConfiguration();
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle(model.title),
								navigationBarTitleDisplayMode('inline'),
								textInputAutocapitalization('never'),
								autocorrectionDisabled()
							]}
						>
							{model.loading ? <ArcaneLoadingViewSwiftUI label="Loading configuration…" /> : null}
							{model.error ? (
								<Section>
									<Text modifiers={[foregroundStyle(systemColors.red)]}>{model.error}</Text>
								</Section>
							) : null}
							{model.blocked ? (
								<Section title="Managed container">
									<Text>Edit this container through its owning project.</Text>
									{model.canOpenProject ? (
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>{`Open project: ${model.config?.composeProject ?? ''}`}</Text>
									) : null}
								</Section>
							) : !model.loading ? (
								<>
									{model.review ? (
										<Section title="Review container replacement">
											<LabeledContent label="Container">
												<Text>{model.draft.name}</Text>
											</LabeledContent>
											<LabeledContent label="Image">
												<Text>{model.draft.image}</Text>
											</LabeledContent>
											<Text>
												Saving recreates the container with a new ID. Running containers are
												interrupted. Settings outside this form are preserved.
											</Text>
											<Text>Review the fields below before choosing Recreate.</Text>
										</Section>
									) : null}
									<ConfigurationSections model={model} />
								</>
							) : null}
							{model.busy ? <ArcaneLoadingViewSwiftUI label="Saving container…" /> : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label={model.cancelTitle}
									onPress={model.cancel}
									modifiers={[...toolbarAccent, disabled(model.busy)]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label={model.confirmTitle}
									onPress={model.confirm}
									modifiers={[...toolbarAccent, disabled(model.confirmDisabled)]}
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
