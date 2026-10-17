import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';
import { m3Type, monoFamily } from '@/ui/components/type-scale';

import { CenteredMessage, M3Section } from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';

import { useRenderCompose } from './use-render-compose';

export function RenderComposeScreen() {
	const model = useRenderCompose();
	const items: AndroidToolbarItem[] = [];
	if (model.showPreview)
		items.push({ kind: 'button', id: 'edit', icon: 'pencil', label: 'Edit', onPress: model.edit });
	else if (model.variableOrder.length > 0)
		items.push({
			kind: 'button',
			id: 'preview',
			icon: 'eye',
			label: 'Preview',
			onPress: model.preview
		});
	items.push({
		kind: 'button',
		id: 'use',
		icon: 'checkmark',
		label: 'Use Resolved',
		disabled: model.variableOrder.length === 0,
		onPress: model.useResolved
	});

	let body;
	if (model.variableOrder.length === 0) {
		body = (
			<CenteredMessage
				icon="checkmark.seal"
				title="No Variables"
				message="This compose file has no ${VAR} placeholders to resolve."
			/>
		);
	} else if (model.showPreview) {
		body = (
			<ScrollView
				style={{ backgroundColor: colors.systemBackground }}
				contentContainerStyle={{ padding: 16 }}
			>
				<Text selectable style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label }}>
					{model.resolved}
				</Text>
			</ScrollView>
		);
	} else {
		body = (
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<Text
					style={[
						m3Type.bodySmall,
						{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 16 }
					]}
				>
					Fill values for the placeholders found in this compose file. Empty values fall back to the
					default (if any).
				</Text>
				<M3Section title="Variables">
					{model.variableOrder.map((key) => {
						const def = model.defaults[key];
						return (
							<View key={key} style={{ paddingTop: 8 }}>
								<View
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										paddingHorizontal: 16,
										gap: 8
									}}
								>
									<Text
										style={{
											fontFamily: monoFamily,
											fontSize: 15,
											fontWeight: '700',
											color: colors.label,
											flex: 1
										}}
									>
										{key}
									</Text>
									{def ? (
										<Text
											numberOfLines={1}
											style={[m3Type.bodySmall, { color: colors.secondaryLabel, flexShrink: 1 }]}
										>{`default: ${def}`}</Text>
									) : null}
								</View>
								<FormTextField
									title="Value"
									placeholder={def ?? 'value'}
									text={model.values[key] ?? ''}
									onChangeText={(text) => model.setValue(key, text)}
									autocapitalization="never"
									autocorrectionDisabled
									monospaced
									layout="stacked"
								/>
							</View>
						);
					})}
				</M3Section>
			</ScrollView>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			<AndroidToolbar
				placement="left"
				items={[
					{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
				]}
			/>
			<AndroidToolbar items={items} />
			{body}
		</>
	);
}
