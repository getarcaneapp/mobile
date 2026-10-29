import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { MaterialSegmentedButtons } from '@/features/images/security/material-segmented';
import { SheetError } from '@/features/networks/android-parts';

import {
	deploymentFormats,
	useAddEnvironment,
	type AddEnvironmentModel
} from './use-add-environment';

function DeploymentSections({ model }: { model: AddEnvironmentModel }) {
	const { phase } = model;
	if (phase.kind !== 'created') return null;
	return (
		<>
			<M3Section title="Connection">
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
					{phase.connected ? (
						<Icon name="checkmark.circle.fill" size={20} color={systemColors.green} />
					) : (
						<ActivityIndicator color={m3.primary} />
					)}
					<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>
						{phase.connected ? 'Agent connected' : 'Waiting for the agent to connect'}
					</Text>
				</View>
			</M3Section>
			<SheetError message={phase.snippetError} />
			{model.snippetText !== undefined ? (
				<M3Section title="Run the Agent">
					<View style={{ padding: 16, gap: 12 }}>
						<MaterialSegmentedButtons
							options={deploymentFormats}
							selection={model.format}
							onSelect={model.setFormat}
						/>
						<Text
							selectable
							style={[
								m3Type.bodySmall,
								{ color: colors.label, fontFamily: 'monospace', lineHeight: 18 }
							]}
						>
							{model.snippetText}
						</Text>
					</View>
					<Pressable
						onPress={model.copySnippet}
						android_ripple={{ color: colors.separator as string }}
						accessibilityRole="button"
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 12,
							minHeight: 48,
							paddingHorizontal: 16
						}}
					>
						<Icon name="doc.on.doc" size={20} color={m3.primary} />
						<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Copy</Text>
					</Pressable>
				</M3Section>
			) : phase.snippetError ? null : (
				<View style={{ padding: 24, alignItems: 'center' }}>
					<ActivityIndicator color={m3.primary} />
				</View>
			)}
		</>
	);
}

export function AddEnvironmentScreen() {
	const model = useAddEnvironment();
	const created = model.phase.kind === 'created';
	return (
		<>
			<Stack.Screen options={{ title: model.title, gestureEnabled: !model.isCreating }} />
			{created ? null : (
				<AndroidToolbar
					placement="left"
					items={[
						{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
					]}
				/>
			)}
			<AndroidToolbar
				items={[
					created
						? { kind: 'button', id: 'done', icon: 'checkmark', label: 'Done', onPress: model.done }
						: {
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
				{created ? (
					<DeploymentSections model={model} />
				) : (
					<>
						<M3Section>
							<FormTextField
								title="Name"
								placeholder="Production"
								text={model.name}
								onChangeText={model.setName}
								autocorrectionDisabled
							/>
						</M3Section>
						<SheetError message={model.errorMessage} />
					</>
				)}
			</ScrollView>
		</>
	);
}
