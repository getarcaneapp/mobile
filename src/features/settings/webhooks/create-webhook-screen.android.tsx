import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { capitalized } from './use-webhooks';
import { useCreateWebhook, type CreateWebhookModel } from './use-create-webhook';
import { webhookTargetTypes } from './webhook-models';

function TargetPicker({ model }: { model: CreateWebhookModel }) {
	if (model.loadingTargets) {
		return (
			<View
				style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 }}
			>
				<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel, flex: 1 }]}>
					Loading targets…
				</Text>
				<ActivityIndicator size="small" />
			</View>
		);
	}
	const select = (title: string, options: { label: string; value: string }[]) => (
		<FormPicker
			title={title}
			selection={model.targetId}
			onSelectionChange={model.setTargetId}
			options={[{ label: 'Select…', value: '' }, ...options]}
		/>
	);
	switch (model.targetType) {
		case 'container':
			return select('Container', model.containerOptions);
		case 'project':
			return select('Project', model.projectOptions);
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
	const model = useCreateWebhook();
	return (
		<>
			<Stack.Screen options={{ title: 'Create Webhook' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'create',
						icon: 'checkmark',
						label: 'Create',
						disabled: model.createDisabled,
						onPress: model.createWebhook
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section
					title="Webhook Details"
					footer="Use a name that explains what this webhook will trigger."
				>
					<FormTextField
						title="Name"
						placeholder="Restart API container"
						text={model.name}
						onChangeText={model.setName}
					/>
				</M3Section>
				<M3Section title="Target">
					<FormPicker
						title="Target Type"
						selection={model.targetType}
						onSelectionChange={model.setTargetType}
						options={webhookTargetTypes.map((type) => ({ label: type.title, value: type.value }))}
					/>
					<FormPicker
						title="Action"
						selection={model.actionType}
						onSelectionChange={model.setActionType}
						options={model.actions.map((action) => ({ label: capitalized(action), value: action }))}
					/>
					{model.needsTargetId ? <TargetPicker model={model} /> : null}
				</M3Section>
				{model.errorMessage ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.red} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
								{model.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
