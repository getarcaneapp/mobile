import { Divider, HStack, Label, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import { font, foregroundStyle, frame, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { ContainerResourceMetrics } from '@/features/containers/container-row';
import { DashboardStatTile } from '@/features/dashboard/components/dashboard-parts';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { DestructiveLabel } from '@/ui/components/labels';
import { RowIcon } from '@/ui/components/row-icon';

import {
	allEnvironmentsWalkthrough,
	refreshedDashboardWalkthrough,
	useAllEnvironmentsPreviewToggle,
	useRefreshedDashboardPreviewToggle
} from './preview-walkthrough';
import { PreviewWalkthroughView } from './preview-walkthrough-view';
import { SampleUsageChart } from './sample-usage-chart';

function EnvironmentCaption({ environment, color }: { environment: string; color: string }) {
	return (
		<HStack spacing={4} modifiers={[font({ textStyle: 'caption' }), foregroundStyle(color)]}>
			<Image systemName="server.rack" />
			<Text>{environment}</Text>
		</HStack>
	);
}

function SampleResource({
	name,
	environment,
	color,
	icon
}: {
	name: string;
	environment: string;
	color: string;
	icon: SFSymbol;
}) {
	return (
		<HStack spacing={12}>
			<Image systemName={icon} modifiers={[foregroundStyle(color)]} />
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{name}</Text>
				<EnvironmentCaption environment={environment} color={color} />
			</VStack>
		</HStack>
	);
}

function allEnvironmentsIllustration(index: number) {
	if (index === 0) {
		return (
			<>
				<Label
					title="All Environments"
					systemImage="server.rack"
					modifiers={[font({ textStyle: 'headline' })]}
				/>
				<SampleResource
					name="Website"
					environment="Production"
					color={systemColors.blue}
					icon="cube.box.fill"
				/>
				<Divider />
				<SampleResource
					name="API"
					environment="Staging"
					color={systemColors.purple}
					icon="cube.box.fill"
				/>
				<Divider />
				<SampleResource
					name="Database"
					environment="Home"
					color={systemColors.teal}
					icon="cube.box.fill"
				/>
			</>
		);
	}
	if (index === 1) {
		return (
			<>
				<HStack modifiers={[font({ textStyle: 'subheadline', weight: 'medium' })]}>
					<Label title="Filter" systemImage="line.3.horizontal.decrease.circle" />
					<Spacer />
					<Text modifiers={[foregroundStyle(systemColors.blue)]}>Production</Text>
				</HStack>
				<Divider />
				<SampleResource
					name="Website"
					environment="Production"
					color={systemColors.blue}
					icon="cube.box.fill"
				/>
				<SampleResource
					name="Worker"
					environment="Production"
					color={systemColors.blue}
					icon="cube.box.fill"
				/>
			</>
		);
	}
	return (
		<>
			<Label title="Check All" systemImage="arrow.clockwise" />
			<Label title="Update All" systemImage="arrow.triangle.2.circlepath" />
			<DestructiveLabel text="Prune" />
			<Divider />
			<Text
				modifiers={[
					font({ textStyle: 'subheadline' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				Across all enabled environments
			</Text>
			<HStack spacing={16}>
				<Image systemName="server.rack" modifiers={[foregroundStyle(systemColors.blue)]} />
				<Image systemName="server.rack" modifiers={[foregroundStyle(systemColors.purple)]} />
				<Image systemName="server.rack" modifiers={[foregroundStyle(systemColors.teal)]} />
			</HStack>
		</>
	);
}

export function AllEnvironmentsIntroductionScreen() {
	const toggle = useAllEnvironmentsPreviewToggle();
	return (
		<PreviewWalkthroughView
			content={allEnvironmentsWalkthrough}
			isEnabled={toggle.isEnabled}
			enable={toggle.enable}
			illustration={allEnvironmentsIllustration}
		/>
	);
}

function SampleContainer({
	name,
	environment,
	color,
	cpu,
	memory
}: {
	name: string;
	environment: string;
	color: string;
	cpu: number;
	memory: number;
}) {
	return (
		<HStack spacing={12}>
			<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} size={32} />
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{name}</Text>
				<EnvironmentCaption environment={environment} color={color} />
			</VStack>
			<Spacer minLength={8} />
			<ContainerResourceMetrics
				sample={{ cpuPercent: cpu, memoryUsageBytes: memory, memoryLimitBytes: 8_000_000_000 }}
			/>
		</HStack>
	);
}

function RefreshedDashboardIllustration({ index }: { index: number }) {
	const accent = useAccentColor();
	if (index === 0) {
		return (
			<>
				<VStack alignment="leading" spacing={2}>
					<Text
						modifiers={[
							font({ textStyle: 'title', design: 'rounded', weight: 'semibold' }),
							monospacedDigit()
						]}
					>
						38.4%
					</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						3 environments · 24 cores
					</Text>
				</VStack>
				<HStack modifiers={[frame({ maxWidth: Infinity, minHeight: 110, maxHeight: 110 })]}>
					<RNHostView>
						<SampleUsageChart height={110} />
					</RNHostView>
				</HStack>
			</>
		);
	}
	if (index === 1) {
		return (
			<>
				<SampleContainer
					name="plex"
					environment="Media"
					color={systemColors.orange}
					cpu={42.6}
					memory={2_100_000_000}
				/>
				<Divider />
				<SampleContainer
					name="postgres"
					environment="Production"
					color={systemColors.blue}
					cpu={18.2}
					memory={1_400_000_000}
				/>
				<Divider />
				<SampleContainer
					name="immich"
					environment="Home"
					color={systemColors.teal}
					cpu={9.7}
					memory={3_800_000_000}
				/>
			</>
		);
	}
	return (
		<>
			<HStack alignment="top" spacing={8}>
				<DashboardStatTile
					title="Running"
					value="42 / 51"
					icon="cube.box.fill"
					tint={systemColors.orange}
				/>
				<DashboardStatTile
					title="Updates"
					value="3"
					icon="arrow.triangle.2.circlepath"
					tint={systemColors.green}
				/>
				<DashboardStatTile
					title="Memory"
					value="61%"
					icon="memorychip.fill"
					tint={systemColors.purple}
				/>
			</HStack>
			<Divider />
			<Label
				title="Edit Tiles"
				systemImage="square.grid.2x2"
				modifiers={[font({ textStyle: 'subheadline', weight: 'medium' }), foregroundStyle(accent)]}
			/>
		</>
	);
}

export function RefreshedDashboardIntroductionScreen() {
	const toggle = useRefreshedDashboardPreviewToggle();
	return (
		<PreviewWalkthroughView
			content={refreshedDashboardWalkthrough}
			isEnabled={toggle.isEnabled}
			enable={toggle.enable}
			illustration={(index) => <RefreshedDashboardIllustration index={index} />}
		/>
	);
}
