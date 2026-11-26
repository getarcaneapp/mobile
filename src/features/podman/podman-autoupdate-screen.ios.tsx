import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	LabeledContent,
	List,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toggle,
	VStack
} from '@expo/ui/swift-ui';
import {
	controlSize,
	disabled,
	font,
	foregroundStyle,
	layoutPriority,
	lineLimit,
	scrollEdgeEffectStyle
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { stableItemKey } from '@/ui/components/stable-sectioned-list.types';

import { autoUpdateUpdatedLabel, autoUpdateUpdatedStatus } from './podman-logic';
import { PodmanStateBadge } from './podman-state-badge';
import { usePodmanAutoUpdate } from './use-podman-autoupdate';

export function PodmanAutoUpdateScreen() {
	const model = usePodmanAutoUpdate();
	return (
		<>
			<Stack.Screen options={{ title: 'Auto-Update', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<Form modifiers={[scrollEdgeEffectStyle('soft', 'top')]}>
					<Section>
						<LabeledContent label="Runs Through">
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{model.modeTitle}
							</Text>
						</LabeledContent>
						{model.supportsOptions ? (
							<>
								<Toggle label="Dry Run" isOn={model.dryRun} onIsOnChange={model.setDryRun} />
								<Toggle
									label="Roll Back on Failure"
									isOn={model.rollback}
									onIsOnChange={model.setRollback}
								/>
							</>
						) : null}
						<Button onPress={model.run} modifiers={[disabled(!model.canRun || model.isRunning)]}>
							<HStack>
								<Label title={model.runTitle} systemImage="arrow.triangle.2.circlepath" />
								{model.isRunning ? (
									<>
										<Spacer />
										<ProgressView modifiers={[controlSize('small')]} />
									</>
								) : null}
							</HStack>
						</Button>
					</Section>
					{model.unit ? (
						<Section title="systemd Unit">
							<LabeledContent label={model.unit.name || 'Unit'}>
								<PodmanStateBadge state={model.unit.activeState} />
							</LabeledContent>
						</Section>
					) : null}
					{model.reports.length > 0 ? (
						<Section title="Containers">
							<List.ForEach
								data={model.reports}
								keyExtractor={stableItemKey}
								estimatedItemSize={56}
							>
								{({ item }) => (
									<HStack spacing={12}>
										<VStack alignment="leading" spacing={3} modifiers={[layoutPriority(1)]}>
											<Text modifiers={[lineLimit(1)]}>
												{item.containerName || item.containerId}
											</Text>
											<Text
												modifiers={[
													font({ textStyle: 'caption' }),
													foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
													lineLimit(1)
												]}
											>
												{item.imageName}
											</Text>
										</VStack>
										<Spacer minLength={8} />
										<ResourceStatusBadge
											key={item.id}
											status={autoUpdateUpdatedStatus(item.updated)}
											isLive={false}
											label={autoUpdateUpdatedLabel(item.updated)}
										/>
									</HStack>
								)}
							</List.ForEach>
						</Section>
					) : model.result && model.result.mode === 'rest' ? (
						<Section>
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								No containers use an auto-update policy.
							</Text>
						</Section>
					) : null}
					{model.errors.length > 0 || model.errorMessage ? (
						<Section>
							{[...(model.errorMessage ? [model.errorMessage] : []), ...model.errors].map(
								(message, index) => (
									<Label
										key={`${index}:${message}`}
										title={message}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
									/>
								)
							)}
						</Section>
					) : null}
				</Form>
			</Host>
		</>
	);
}
