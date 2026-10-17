import { Host } from '@/ui/host';
import {
	Alert,
	Button,
	HStack,
	Label,
	LabeledContent,
	List,
	Menu,
	ProgressView,
	SecureField,
	Section,
	Spacer,
	Text,
	VStack,
	useNativeState
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	refreshable,
	scrollEdgeEffectStyle,
	textSelection,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { systemColors } from '@/theme/colors';
import { DestructiveLabel } from '@/ui/components/labels';

import { copyToClipboard, CopyValueRow } from './swarm-parts';
import { maskedToken, useSwarmCluster, type SwarmClusterModel } from './use-swarm-cluster';

function TokenRow({
	model,
	title,
	token
}: {
	model: SwarmClusterModel;
	title: string;
	token: string;
}) {
	const isRevealed = model.revealed.has(title);
	return (
		<VStack alignment="leading" spacing={6}>
			<HStack>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{title}</Text>
				<Spacer />
				<Button
					onPress={() => model.toggleRevealed(title)}
					modifiers={[
						buttonStyle('borderless'),
						accessibilityLabel(isRevealed ? `Hide ${title}` : `Reveal ${title}`)
					]}
				>
					<Image systemName={isRevealed ? 'eye.slash' : 'eye'} />
				</Button>
				<Button
					onPress={() => void copyToClipboard(token)}
					modifiers={[buttonStyle('borderless'), accessibilityLabel(`Copy ${title}`)]}
				>
					<Image systemName="doc.on.doc" />
				</Button>
			</HStack>
			<Text
				modifiers={[
					font({ textStyle: 'caption', design: 'monospaced' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					textSelection(true),
					...(isRevealed ? [] : [lineLimit(1)])
				]}
			>
				{isRevealed ? token : maskedToken}
			</Text>
		</VStack>
	);
}

function UnlockKeyField({
	value,
	onChangeText
}: {
	value: string;
	onChangeText: (text: string) => void;
}) {
	const state = useNativeState(value);
	useEffect(() => {
		if (state.value !== value) state.value = value;
	}, [state, value]);
	return <SecureField text={state} placeholder="Unlock key" onTextChange={onChangeText} />;
}

export function SwarmClusterScreen() {
	const model = useSwarmCluster();
	const { info, tokens } = model;
	return (
		<>
			<Stack.Screen options={{ title: 'Cluster' }} />
			<Host style={{ flex: 1 }}>
				<List
					modifiers={[
						listStyle('insetGrouped'),
						scrollEdgeEffectStyle('soft', 'top'),
						refreshable(model.load)
					]}
				>
					{info ? (
						<Section title="Cluster">
							<CopyValueRow title="ID" value={info.id} />
							<LabeledContent label="Created">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{model.createdText}
								</Text>
							</LabeledContent>
							<LabeledContent label="Updated">
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{model.updatedText}
								</Text>
							</LabeledContent>
							{info.rootRotationInProgress ? (
								<Label
									title="Root CA rotation in progress"
									systemImage="arrow.triangle.2.circlepath"
									modifiers={[foregroundStyle(systemColors.orange)]}
								/>
							) : null}
						</Section>
					) : null}
					{model.canUnlock ? (
						<>
							<Section
								header={<Text>Join Tokens</Text>}
								footer={<Text>Use with docker swarm join on the node you want to add.</Text>}
							>
								{tokens ? (
									<>
										<TokenRow model={model} title="Worker" token={tokens.worker} />
										<TokenRow model={model} title="Manager" token={tokens.manager} />
										<Menu
											label={
												<Label title="Rotate Tokens" systemImage="arrow.triangle.2.circlepath" />
											}
										>
											<Button
												label="Rotate Worker Token"
												onPress={() => model.requestRotation('worker')}
											/>
											<Button
												label="Rotate Manager Token"
												onPress={() => model.requestRotation('manager')}
											/>
										</Menu>
									</>
								) : (
									<ProgressView modifiers={[frame({ maxWidth: Infinity })]} />
								)}
							</Section>
							<Section header={<Text>Autolock</Text>}>
								{model.unlockKey !== undefined ? (
									model.unlockKey === '' ? (
										<Text
											modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
										>
											Autolock is off, so there's no unlock key.
										</Text>
									) : (
										<TokenRow model={model} title="Unlock Key" token={model.unlockKey} />
									)
								) : (
									<Button onPress={model.loadUnlockKey}>
										<Label title="Show Unlock Key" systemImage="key" />
									</Button>
								)}
								<Alert
									title="Unlock Swarm"
									isPresented={model.showUnlock}
									onIsPresentedChange={model.setShowUnlock}
								>
									<Alert.Trigger>
										<Button onPress={model.beginUnlock}>
											<Label title="Unlock Swarm" systemImage="lock.open" />
										</Button>
									</Alert.Trigger>
									<Alert.Actions>
										<UnlockKeyField value={model.unlockInput} onChangeText={model.setUnlockInput} />
										<Button label="Unlock" onPress={model.commitUnlock} />
										<Button
											label="Cancel"
											role="cancel"
											onPress={() => model.setShowUnlock(false)}
										/>
									</Alert.Actions>
									<Alert.Message>
										<Text>Enter the key shown when autolock was enabled.</Text>
									</Alert.Message>
								</Alert>
							</Section>
						</>
					) : null}
					{model.canLeave ? (
						<Section footer={<Text>This environment's Docker host leaves the swarm.</Text>}>
							<Button
								role="destructive"
								onPress={model.requestLeave}
								modifiers={[tint(systemColors.red), disabled(model.isWorking)]}
							>
								<DestructiveLabel
									text="Leave Swarm"
									systemImage="rectangle.portrait.and.arrow.right"
								/>
							</Button>
						</Section>
					) : null}
					{model.errorMessage ? (
						<Section>
							<Label
								title={model.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.orange)]}
							/>
						</Section>
					) : null}
				</List>
			</Host>
		</>
	);
}
