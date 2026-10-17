/**
 * Android rendering of `SwarmServiceEditorView`. Swipe-to-delete rows become
 * a trailing remove button; the segmented mount type is a Material segmented row.
 */
import { Stack } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { FormPicker, FormTextField, FormValueRow } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, SwitchRow } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { ActionItem, SheetError } from '@/features/networks/android-parts';

import type { SwarmServiceMode } from './swarm-spec-draft';
import { ReplicaStepper } from './swarm-services-view';
import {
	useSwarmServiceEditor,
	type PairsField,
	type SwarmServiceEditorModel
} from './use-swarm-service-editor';

function Field({
	placeholder,
	value,
	onChangeText,
	monospaced,
	numeric
}: {
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
	monospaced?: boolean;
	numeric?: boolean;
}) {
	return (
		<TextInput
			value={value}
			onChangeText={onChangeText}
			placeholder={placeholder}
			placeholderTextColor={colors.secondaryLabel}
			accessibilityLabel={placeholder}
			autoCapitalize="none"
			autoCorrect={false}
			keyboardType={numeric ? 'number-pad' : 'default'}
			style={[
				m3Type.bodyLarge,
				{
					flex: 1,
					color: colors.label,
					borderWidth: 1,
					borderColor: m3.outline,
					borderRadius: 4,
					paddingHorizontal: 10,
					paddingVertical: 8,
					fontFamily: monospaced ? monoFamily : undefined
				}
			]}
		/>
	);
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
			style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
		>
			<Icon name="minus.circle.fill" size={22} color={m3.error} />
		</Pressable>
	);
}

function Segmented<Value extends string>({
	options,
	selection,
	onSelect
}: {
	options: { value: Value; title: string }[];
	selection: Value;
	onSelect: (value: Value) => void;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				borderWidth: 1,
				borderColor: m3.outline,
				borderRadius: 999,
				overflow: 'hidden'
			}}
		>
			{options.map((option, index) => {
				const selected = option.value === selection;
				return (
					<Pressable
						key={option.value}
						onPress={() => onSelect(option.value)}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						style={{
							flex: 1,
							minHeight: 40,
							alignItems: 'center',
							justifyContent: 'center',
							flexDirection: 'row',
							gap: 6,
							backgroundColor: selected ? m3.secondaryContainer : 'transparent',
							borderLeftWidth: index === 0 ? 0 : 1,
							borderLeftColor: m3.outline
						}}
					>
						{selected ? <Icon name="checkmark" size={16} color={m3.onSecondaryContainer} /> : null}
						<Text
							style={[
								m3Type.labelLarge,
								{ color: selected ? m3.onSecondaryContainer : colors.label }
							]}
						>
							{option.title}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

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
		<M3Section title={title}>
			{model.draft[field].map((pair, index) => (
				<View
					key={pair.id}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 8,
						paddingHorizontal: 16,
						paddingVertical: 6
					}}
				>
					<Field
						placeholder={keyPlaceholder}
						value={pair.key}
						onChangeText={(key) => model.updatePair(field, pair.id, { key })}
						monospaced
					/>
					<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel }]}>=</Text>
					<Field
						placeholder="value"
						value={pair.value}
						onChangeText={(value) => model.updatePair(field, pair.id, { value })}
						monospaced
					/>
					<RemoveButton label="Remove" onPress={() => model.removeAt(field, [index])} />
				</View>
			))}
			<ActionItem title={addTitle} icon="plus" onPress={() => model.addPair(field)} />
		</M3Section>
	);
}

export function SwarmServiceEditorScreen() {
	const model = useSwarmServiceEditor();
	const { draft } = model;
	return (
		<>
			<Stack.Screen
				options={{ title: model.title, gestureEnabled: !(model.isSaving || model.hasChanges) }}
			/>
			<AndroidToolbar
				placement="left"
				items={[
					{
						kind: 'button',
						id: 'cancel',
						icon: 'xmark',
						label: 'Cancel',
						disabled: model.isSaving,
						onPress: model.cancel
					}
				]}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'save',
						icon: 'checkmark',
						label: model.saveTitle,
						disabled: !model.canSave,
						onPress: model.save
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Service">
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
				</M3Section>
				<M3Section title="Scheduling">
					{draft.mode === 'job' ? (
						<FormValueRow title="Mode" value="Job" />
					) : (
						<>
							{model.isEditing ? (
								<FormValueRow
									title="Mode"
									value={draft.mode === 'replicated' ? 'Replicated' : 'Global'}
								/>
							) : (
								<FormPicker<SwarmServiceMode>
									title="Mode"
									selection={draft.mode}
									onSelectionChange={(mode) => model.update({ mode })}
									options={[
										{ label: 'Replicated', value: 'replicated' },
										{ label: 'Global', value: 'global' }
									]}
								/>
							)}
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
				</M3Section>
				<M3Section title="Ports">
					{draft.ports.map((port, index) => (
						<View
							key={port.id}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 8,
								paddingHorizontal: 16,
								paddingVertical: 6
							}}
						>
							<Field
								placeholder="Published"
								value={port.published}
								onChangeText={(published) => model.updatePort(port.id, { published })}
								numeric
							/>
							<Icon name="arrow.right" size={16} color={colors.secondaryLabel} />
							<Field
								placeholder="Target"
								value={port.target}
								onChangeText={(target) => model.updatePort(port.id, { target })}
								numeric
							/>
							<Pressable
								onPress={() =>
									model.updatePort(port.id, { proto: port.proto === 'tcp' ? 'udp' : 'tcp' })
								}
								accessibilityRole="button"
								accessibilityLabel="Protocol"
								style={{ paddingHorizontal: 8, paddingVertical: 8 }}
							>
								<Text style={[m3Type.labelLarge, { color: m3.primary }]}>
									{port.proto.toUpperCase()}
								</Text>
							</Pressable>
							<RemoveButton label="Remove port" onPress={() => model.removeAt('ports', [index])} />
						</View>
					))}
					<ActionItem title="Add Port" icon="plus" onPress={model.addPort} />
				</M3Section>
				<PairsSection
					model={model}
					title="Environment"
					field="env"
					keyPlaceholder="KEY"
					addTitle="Add Variable"
				/>
				<M3Section title="Mounts">
					{draft.mounts.map((mount, index) => (
						<View key={mount.id} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
								<View style={{ flex: 1 }}>
									<Segmented
										options={[
											{ value: 'volume', title: 'Volume' },
											{ value: 'bind', title: 'Bind' },
											{ value: 'tmpfs', title: 'tmpfs' }
										]}
										selection={mount.type}
										onSelect={(type) => model.updateMount(mount.id, { type })}
									/>
								</View>
								<RemoveButton
									label="Remove mount"
									onPress={() => model.removeAt('mounts', [index])}
								/>
							</View>
							{mount.type !== 'tmpfs' ? (
								<Field
									placeholder={mount.type === 'bind' ? 'Host path' : 'Volume name'}
									value={mount.source}
									onChangeText={(source) => model.updateMount(mount.id, { source })}
								/>
							) : null}
							<Field
								placeholder="Container path"
								value={mount.target}
								onChangeText={(target) => model.updateMount(mount.id, { target })}
							/>
							<View style={{ marginHorizontal: -16 }}>
								<SwitchRow
									title="Read-only"
									value={mount.readOnly}
									onValueChange={(readOnly) => model.updateMount(mount.id, { readOnly })}
								/>
							</View>
						</View>
					))}
					<ActionItem title="Add Mount" icon="plus" onPress={model.addMount} />
				</M3Section>
				<PairsSection
					model={model}
					title="Labels"
					field="labels"
					keyPlaceholder="com.example.key"
					addTitle="Add Label"
				/>
				<M3Section
					title="Advanced"
					footer="Separate arguments with spaces; quote values that contain spaces."
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
				</M3Section>
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}
