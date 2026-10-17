import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3Type } from '@/ui/components/type-scale';

import { AndroidToolbar } from './android-toolbar';
import {
	M3Section,
	M3TextField,
	RadioGroup,
	SwitchRow,
	TextButtonRow,
	ValueRow
} from './android-material';
import type { ContainerConfigurationDraft } from './container-configuration-draft';
import { useContainerConfiguration } from './use-container-configuration';

const Divider = () => (
	<View style={{ height: 0.5, marginHorizontal: 16, backgroundColor: colors.separator }} />
);

export function ContainerConfigurationScreen() {
	const model = useContainerConfiguration();
	const { draft, update } = model;
	const set = (key: keyof ContainerConfigurationDraft) => (text: string) =>
		update({ [key]: text } as Partial<ContainerConfigurationDraft>);
	const editable = !model.review;
	const field = (
		label: string,
		key: keyof ContainerConfigurationDraft,
		options: { multiline?: boolean; numeric?: boolean } = {}
	) => (
		<M3TextField
			label={label}
			value={draft[key] as string}
			onChangeText={set(key)}
			multiline={options.multiline}
			monospaced={options.multiline}
			keyboardType={options.numeric ? 'numbers-and-punctuation' : undefined}
			editable={editable}
		/>
	);

	return (
		<>
			<Stack.Screen options={{ title: model.title, headerBackVisible: !model.review }} />
			<AndroidToolbar
				items={[
					...(model.review
						? [
								{
									kind: 'button' as const,
									id: 'back',
									icon: 'arrow.uturn.backward',
									label: model.cancelTitle,
									disabled: model.busy,
									onPress: model.cancel
								}
							]
						: []),
					{
						kind: 'button',
						id: 'confirm',
						icon: 'checkmark',
						label: model.confirmTitle,
						disabled: model.confirmDisabled,
						onPress: model.confirm
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
			>
				{model.loading ? (
					<View style={{ padding: 24, alignItems: 'center' }}>
						<ArcaneLoadingView label="Loading configuration…" />
					</View>
				) : null}
				{model.error ? (
					<Text style={[m3Type.bodyMedium, { color: systemColors.red, padding: 16 }]}>
						{model.error}
					</Text>
				) : null}
				{model.blocked ? (
					<M3Section title="Managed container">
						<Text style={[m3Type.bodyLarge, { color: colors.label, padding: 16 }]}>
							Edit this container through its owning project.
						</Text>
						{model.canOpenProject ? (
							<ValueRow title="Project" value={model.config?.composeProject ?? ''} />
						) : null}
					</M3Section>
				) : !model.loading ? (
					<>
						{model.review ? (
							<M3Section
								title="Review container replacement"
								footer="Review the fields below before choosing Recreate."
							>
								<ValueRow title="Container" value={draft.name} />
								<ValueRow title="Image" value={draft.image} />
								<Text style={[m3Type.bodyMedium, { color: colors.label, padding: 16 }]}>
									Saving recreates the container with a new ID. Running containers are interrupted.
									Settings outside this form are preserved.
								</Text>
							</M3Section>
						) : null}
						<M3Section title="Container">
							{field('Name', 'name')}
							{field('Image', 'image')}
							{field('Working directory', 'workingDir')}
							{field('User', 'user')}
						</M3Section>
						<M3Section title="Command">
							{field('Command arguments, one per line', 'command', { multiline: true })}
							{field('Entrypoint arguments, one per line', 'entrypoint', { multiline: true })}
						</M3Section>
						<M3Section title="Environment variables">
							{field('NAME=value, one per line', 'environment', { multiline: true })}
						</M3Section>
						<M3Section title="Ports">
							{draft.ports.map((port) => (
								<View key={port.id}>
									<M3TextField
										label="Container port (80/tcp)"
										value={port.port}
										onChangeText={(text) => model.updatePort(port.id, { port: text })}
										editable={editable}
									/>
									<M3TextField
										label="Host address (optional)"
										value={port.hostIP}
										onChangeText={(text) => model.updatePort(port.id, { hostIP: text })}
										editable={editable}
									/>
									<M3TextField
										label="Host port (blank for automatic)"
										value={port.hostPort}
										onChangeText={(text) => model.updatePort(port.id, { hostPort: text })}
										keyboardType="number-pad"
										editable={editable}
									/>
									<TextButtonRow
										title="Remove port"
										destructive
										disabled={!editable}
										onPress={() => model.removeItem('ports', port.id)}
									/>
									<Divider />
								</View>
							))}
							<TextButtonRow title="Add port" disabled={!editable} onPress={model.addPort} />
						</M3Section>
						<M3Section title="Mounts">
							{draft.mounts.map((mount) => (
								<View key={mount.id}>
									<RadioGroup
										options={[
											{ value: 'volume', title: 'Volume' },
											{ value: 'bind', title: 'Bind mount' }
										]}
										selection={mount.type}
										onSelect={(value) => editable && model.updateMount(mount.id, { type: value })}
									/>
									<M3TextField
										label="Source volume or host path"
										value={mount.source}
										onChangeText={(text) => model.updateMount(mount.id, { source: text })}
										editable={editable}
									/>
									<M3TextField
										label="Container path"
										value={mount.target}
										onChangeText={(text) => model.updateMount(mount.id, { target: text })}
										editable={editable}
									/>
									<SwitchRow
										title="Read only"
										value={mount.readOnly}
										disabled={!editable}
										onValueChange={(value) => model.updateMount(mount.id, { readOnly: value })}
									/>
									<TextButtonRow
										title="Remove mount"
										destructive
										disabled={!editable}
										onPress={() => model.removeItem('mounts', mount.id)}
									/>
									<Divider />
								</View>
							))}
							<TextButtonRow title="Add mount" disabled={!editable} onPress={model.addMount} />
							{draft.binds !== ''
								? field('Existing volume bindings, one per line', 'binds', { multiline: true })
								: null}
						</M3Section>
						<M3Section
							title="Networks"
							footer={
								model.preservesNetworkMode
									? "This container's network mode is preserved."
									: undefined
							}
						>
							{model.preservesNetworkMode ? (
								<ValueRow title="Network mode" value={model.networkMode ?? ''} />
							) : (
								<>
									{draft.networks.map((network) => (
										<View key={network.id}>
											<M3TextField
												label="Network name"
												value={network.name}
												onChangeText={(text) => model.updateNetwork(network.id, { name: text })}
												editable={editable}
											/>
											<M3TextField
												label="Aliases, one per line"
												value={network.aliases}
												multiline
												onChangeText={(text) => model.updateNetwork(network.id, { aliases: text })}
												editable={editable}
											/>
											<M3TextField
												label="Static IPv4 address (optional)"
												value={network.ipv4}
												onChangeText={(text) => model.updateNetwork(network.id, { ipv4: text })}
												editable={editable}
											/>
											<M3TextField
												label="Static IPv6 address (optional)"
												value={network.ipv6}
												onChangeText={(text) => model.updateNetwork(network.id, { ipv6: text })}
												editable={editable}
											/>
											<TextButtonRow
												title="Remove network"
												destructive
												disabled={!editable}
												onPress={() => model.removeItem('networks', network.id)}
											/>
											<Divider />
										</View>
									))}
									<TextButtonRow
										title="Add network"
										disabled={!editable}
										onPress={model.addNetwork}
									/>
								</>
							)}
						</M3Section>
						<M3Section title="Restart policy">
							<RadioGroup
								options={[
									{ value: 'no', title: 'Never' },
									{ value: 'always', title: 'Always' },
									{ value: 'unless-stopped', title: 'Unless stopped' },
									{ value: 'on-failure', title: 'On failure' }
								]}
								selection={draft.restartPolicy}
								onSelect={(value) => editable && update({ restartPolicy: value })}
							/>
							{draft.restartPolicy === 'on-failure'
								? field('Maximum retries', 'retryCount', { numeric: true })
								: null}
							<SwitchRow
								title="Remove when stopped"
								value={draft.autoRemove}
								disabled={!editable}
								onValueChange={(value) => update({ autoRemove: value })}
							/>
						</M3Section>
						<M3Section title="Health check">
							<RadioGroup
								options={[
									{ value: 'inherit' as const, title: 'Use image default' },
									{ value: 'disabled' as const, title: 'Disabled' },
									{ value: 'custom' as const, title: 'Custom' }
								]}
								selection={draft.healthMode}
								onSelect={(value) => editable && update({ healthMode: value })}
							/>
							{draft.healthMode === 'custom' ? (
								<>
									{field('CMD or CMD-SHELL, then arguments on separate lines', 'healthCommand', {
										multiline: true
									})}
									{field('Interval (seconds)', 'interval', { numeric: true })}
									{field('Timeout (seconds)', 'timeout', { numeric: true })}
									{field('Start period (seconds)', 'startPeriod', { numeric: true })}
									{field('Start interval (seconds)', 'startInterval', { numeric: true })}
									{field('Retries', 'retries', { numeric: true })}
								</>
							) : null}
						</M3Section>
						<M3Section title="Advanced runtime">
							<SwitchRow
								title="Privileged"
								value={draft.privileged}
								disabled={!editable}
								onValueChange={(value) => update({ privileged: value })}
							/>
							<SwitchRow
								title="Read-only root filesystem"
								value={draft.readOnly}
								disabled={!editable}
								onValueChange={(value) => update({ readOnly: value })}
							/>
							{field('Memory limit (bytes, 0 for unlimited)', 'memory', { numeric: true })}
							{field('Memory and swap (bytes, -1 for unlimited)', 'memorySwap', { numeric: true })}
							{field('CPU allocation (billionths of a CPU)', 'nanoCPUs', { numeric: true })}
							{field('CPU shares', 'cpuShares', { numeric: true })}
							{field('Added capabilities, one per line', 'capAdd', { multiline: true })}
							{field('Dropped capabilities, one per line', 'capDrop', { multiline: true })}
							{field('Labels: name=value, one per line', 'labels', { multiline: true })}
						</M3Section>
					</>
				) : null}
				{model.busy ? (
					<View style={{ padding: 24, alignItems: 'center' }}>
						<ArcaneLoadingView label="Saving container…" />
					</View>
				) : null}
			</ScrollView>
		</>
	);
}
