import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { HStack, LabeledContent, List, Section, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	font,
	foregroundStyle,
	frame,
	listStyle,
	refreshable,
	scrollEdgeEffectStyle
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { EnvironmentID } from '@/sdk/client/environment';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';

import { LinkRow } from '@/features/containers/container-sections';

import { usePodmanHub } from './use-podman';

export function PodmanScreen({
	environmentID,
	environmentName
}: {
	environmentID: EnvironmentID;
	environmentName: string;
}) {
	const hub = usePodmanHub(environmentID);
	const accent = useAccentColor();
	const { status } = hub;

	let content;
	if (status?.detected) {
		content = (
			<List
				modifiers={[
					listStyle('insetGrouped'),
					scrollEdgeEffectStyle('soft', 'top'),
					refreshable(hub.load)
				]}
			>
				<Section>
					<HStack spacing={14}>
						<Image
							systemName="cube.transparent"
							modifiers={[
								font({ textStyle: 'title2' }),
								foregroundStyle(accent),
								frame({ width: 44, height: 44 }),
								accessibilityHidden(true)
							]}
						/>
						<VStack alignment="leading" spacing={3}>
							<Text modifiers={[font({ textStyle: 'headline' })]}>{environmentName}</Text>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{hub.podCountText}
							</Text>
						</VStack>
					</HStack>
					{hub.details.map((detail) => (
						<LabeledContent key={detail.title} label={detail.title}>
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{detail.value}
							</Text>
						</LabeledContent>
					))}
					{hub.systemdReason ? (
						<Text
							modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(systemColors.orange)]}
						>
							{hub.systemdReason}
						</Text>
					) : null}
				</Section>
				{hub.canPods || hub.canQuadlets || hub.canKube ? (
					<Section title="Workloads">
						{hub.canPods ? (
							<LinkRow title="Pods" systemImage="circle.hexagongrid.fill" onPress={hub.openPods} />
						) : null}
						{hub.canQuadlets ? (
							<LinkRow
								title="Quadlets"
								systemImage="doc.badge.gearshape"
								onPress={hub.openQuadlets}
							/>
						) : null}
						{hub.canKube ? (
							<LinkRow
								title="Kube"
								systemImage="square.stack.3d.down.right"
								onPress={hub.openKube}
							/>
						) : null}
					</Section>
				) : null}
				{hub.canSecrets || hub.canAutoUpdate ? (
					<Section title="Configuration">
						{hub.canSecrets ? (
							<LinkRow title="Secrets" systemImage="key.fill" onPress={hub.openSecrets} />
						) : null}
						{hub.canAutoUpdate ? (
							<LinkRow
								title="Auto-Update"
								systemImage="arrow.triangle.2.circlepath"
								onPress={hub.openAutoUpdate}
							/>
						) : null}
					</Section>
				) : null}
			</List>
		);
	} else if (status !== undefined) {
		content = (
			<UnavailableView
				title="Podman Not Detected"
				systemImage="cube.transparent"
				description={status.reason ?? `${environmentName} doesn't run Podman.`}
				actions={[{ title: 'Check Again', onPress: () => void hub.load() }]}
			/>
		);
	} else if (hub.errorMessage !== undefined) {
		content = (
			<UnavailableView
				title="Couldn't Load Podman"
				systemImage="exclamationmark.triangle"
				description={hub.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void hub.load() }]}
			/>
		);
	} else {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Podman' }} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
