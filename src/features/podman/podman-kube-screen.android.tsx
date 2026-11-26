import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';

import { M3Section, SwitchRow } from '@/features/containers/android-material';
import { ActionItem, SheetError } from '@/features/networks/android-parts';

import { usePodmanKube } from './use-podman-kube';

export function PodmanKubeScreen() {
	const model = usePodmanKube();
	const spinner = <ActivityIndicator size="small" />;
	return (
		<>
			<Stack.Screen options={{ title: 'Kube' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section
					title="Kubernetes YAML"
					footer={model.generatedFrom ? `Generated from ${model.generatedFrom}.` : undefined}
				>
					{model.running === 'generate' ? (
						<View style={{ padding: 24, alignItems: 'center' }}>{spinner}</View>
					) : (
						<TextInput
							value={model.yaml}
							onChangeText={model.setYAML}
							editable={!model.isBusy}
							multiline
							autoCapitalize="none"
							autoCorrect={false}
							accessibilityLabel="Kubernetes YAML"
							placeholder="apiVersion: v1"
							placeholderTextColor={colors.secondaryLabel}
							style={{
								minHeight: 260,
								margin: 16,
								padding: 12,
								borderWidth: 1,
								borderColor: m3.outline,
								borderRadius: 4,
								fontFamily: monoFamily,
								fontSize: 13,
								color: colors.label,
								textAlignVertical: 'top'
							}}
						/>
					)}
				</M3Section>
				{model.canPlay ? (
					<M3Section title="Play">
						<SwitchRow title="Start Pods" value={model.start} onValueChange={model.setStart} />
						<SwitchRow
							title="Replace Existing"
							value={model.replace}
							onValueChange={model.setReplace}
						/>
						<ActionItem
							title="Play"
							icon="play.fill"
							onPress={model.play}
							disabled={!model.canSubmitPlay}
							trailing={model.running === 'play' ? spinner : undefined}
						/>
					</M3Section>
				) : null}
				{model.canDown ? (
					<M3Section title="Tear Down">
						<SwitchRow title="Remove Volumes" value={model.force} onValueChange={model.setForce} />
						<ActionItem
							title="Tear Down"
							icon="stop.circle"
							destructive
							onPress={model.requestDown}
							disabled={!model.canSubmitDown}
							trailing={model.running === 'down' ? spinner : undefined}
						/>
					</M3Section>
				) : null}
				{model.resultLines.length > 0 ? (
					<M3Section title="Result">
						{model.resultLines.map((line, index) => (
							<Text
								key={`${index}:${line}`}
								selectable
								style={[
									m3Type.bodyMedium,
									{
										fontFamily: monoFamily,
										color: colors.label,
										paddingHorizontal: 16,
										paddingVertical: 8
									}
								]}
							>
								{line}
							</Text>
						))}
					</M3Section>
				) : null}
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}
