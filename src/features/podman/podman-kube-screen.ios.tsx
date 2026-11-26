import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toggle
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	scrollEdgeEffectStyle,
	textInputAutocapitalization,
	textSelection,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors } from '@/theme/colors';

import { BoundTextField } from '@/features/containers/swiftui-text-field';

import { usePodmanKube } from './use-podman-kube';

function RunButton({
	title,
	systemImage,
	running,
	isDisabled,
	destructive,
	onPress
}: {
	title: string;
	systemImage: string;
	running: boolean;
	isDisabled: boolean;
	destructive?: boolean;
	onPress: () => void;
}) {
	return (
		<Button
			onPress={onPress}
			role={destructive ? 'destructive' : undefined}
			modifiers={[disabled(isDisabled), ...(destructive ? [tint(systemColors.red)] : [])]}
		>
			<HStack>
				<Label title={title} systemImage={systemImage as SFSymbol} />
				{running ? (
					<>
						<Spacer />
						<ProgressView modifiers={[controlSize('small')]} />
					</>
				) : null}
			</HStack>
		</Button>
	);
}

export function PodmanKubeScreen() {
	const model = usePodmanKube();
	return (
		<>
			<Stack.Screen options={{ title: 'Kube', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form modifiers={[scrollEdgeEffectStyle('soft', 'top')]}>
					<Section
						title="Kubernetes YAML"
						footer={
							model.generatedFrom ? (
								<Text>{`Generated from ${model.generatedFrom}.`}</Text>
							) : undefined
						}
					>
						{model.running === 'generate' ? (
							<ProgressView />
						) : (
							<BoundTextField
								placeholder="apiVersion: v1"
								value={model.yaml}
								onChangeText={model.setYAML}
								axis="vertical"
								modifiers={[
									font({ textStyle: 'caption', design: 'monospaced' }),
									textInputAutocapitalization('never'),
									autocorrectionDisabled(),
									disabled(model.isBusy),
									frame({ minHeight: 260, alignment: 'topLeading' })
								]}
							/>
						)}
					</Section>
					{model.canPlay ? (
						<Section title="Play">
							<Toggle label="Start Pods" isOn={model.start} onIsOnChange={model.setStart} />
							<Toggle
								label="Replace Existing"
								isOn={model.replace}
								onIsOnChange={model.setReplace}
							/>
							<RunButton
								title="Play"
								systemImage="play.fill"
								running={model.running === 'play'}
								isDisabled={!model.canSubmitPlay}
								onPress={model.play}
							/>
						</Section>
					) : null}
					{model.canDown ? (
						<Section title="Tear Down">
							<Toggle label="Remove Volumes" isOn={model.force} onIsOnChange={model.setForce} />
							<RunButton
								title="Tear Down"
								systemImage="stop.circle"
								running={model.running === 'down'}
								isDisabled={!model.canSubmitDown}
								destructive
								onPress={model.requestDown}
							/>
						</Section>
					) : null}
					{model.resultLines.length > 0 ? (
						<Section title="Result">
							{model.resultLines.map((line, index) => (
								<Text
									key={`${index}:${line}`}
									modifiers={[
										font({ textStyle: 'callout', design: 'monospaced' }),
										textSelection(true)
									]}
								>
									{line}
								</Text>
							))}
						</Section>
					) : null}
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
			</Host>
		</>
	);
}
