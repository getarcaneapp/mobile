import { Text, View } from 'react-native';

import { ContainerResourceMetrics } from '@/features/containers/container-row';
import { DashboardStatTile } from '@/features/dashboard/components/dashboard-parts';
import { colors, systemColors } from '@/theme/colors';
import { DestructiveLabel } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	allEnvironmentsWalkthrough,
	refreshedDashboardWalkthrough,
	useAllEnvironmentsPreviewToggle,
	useRefreshedDashboardPreviewToggle
} from './preview-walkthrough';
import { PreviewWalkthroughView } from './preview-walkthrough-view';
import { SampleUsageChart } from './sample-usage-chart';

function Divider() {
	return <View style={{ height: 1, backgroundColor: colors.separator }} />;
}

function IconLabel({
	title,
	icon,
	color = colors.label as string,
	bold
}: {
	title: string;
	icon: string;
	color?: string;
	bold?: boolean;
}) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<Icon name={icon} size={22} color={color} />
			<Text style={[bold ? m3Type.titleMedium : m3Type.bodyLarge, { color }]}>{title}</Text>
		</View>
	);
}

function EnvironmentCaption({ environment, color }: { environment: string; color: string }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
			<Icon name="server.rack" size={12} color={color} />
			<Text style={[m3Type.bodySmall, { color }]}>{environment}</Text>
		</View>
	);
}

function SampleResource({
	name,
	environment,
	color
}: {
	name: string;
	environment: string;
	color: string;
}) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<Icon name="cube.box.fill" size={22} color={color} />
			<View style={{ gap: 4 }}>
				<Text style={[m3Type.titleMedium, { color: colors.label }]}>{name}</Text>
				<EnvironmentCaption environment={environment} color={color} />
			</View>
		</View>
	);
}

function allEnvironmentsIllustration(index: number) {
	if (index === 0) {
		return (
			<>
				<IconLabel title="All Environments" icon="server.rack" bold />
				<SampleResource name="Website" environment="Production" color={systemColors.blue} />
				<Divider />
				<SampleResource name="API" environment="Staging" color={systemColors.purple} />
				<Divider />
				<SampleResource name="Database" environment="Home" color={systemColors.teal} />
			</>
		);
	}
	if (index === 1) {
		return (
			<>
				<View
					style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
				>
					<IconLabel title="Filter" icon="line.3.horizontal.decrease.circle" />
					<Text style={[m3Type.titleSmall, { color: systemColors.blue }]}>Production</Text>
				</View>
				<Divider />
				<SampleResource name="Website" environment="Production" color={systemColors.blue} />
				<SampleResource name="Worker" environment="Production" color={systemColors.blue} />
			</>
		);
	}
	return (
		<>
			<IconLabel title="Check All" icon="arrow.clockwise" />
			<IconLabel title="Update All" icon="arrow.triangle.2.circlepath" />
			<DestructiveLabel text="Prune" />
			<Divider />
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
				Across all enabled environments
			</Text>
			<View style={{ flexDirection: 'row', gap: 16 }}>
				<Icon name="server.rack" size={22} color={systemColors.blue} />
				<Icon name="server.rack" size={22} color={systemColors.purple} />
				<Icon name="server.rack" size={22} color={systemColors.teal} />
			</View>
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
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} size={32} />
			<View style={{ flex: 1, gap: 4 }}>
				<Text style={[m3Type.titleMedium, { color: colors.label }]}>{name}</Text>
				<EnvironmentCaption environment={environment} color={color} />
			</View>
			<ContainerResourceMetrics
				sample={{ cpuPercent: cpu, memoryUsageBytes: memory, memoryLimitBytes: 8_000_000_000 }}
			/>
		</View>
	);
}

function refreshedDashboardIllustration(index: number) {
	if (index === 0) {
		return (
			<>
				<View style={{ gap: 2 }}>
					<Text
						style={[
							m3Type.headlineSmall,
							{ color: colors.label, fontWeight: '600', fontVariant: ['tabular-nums'] }
						]}
					>
						38.4%
					</Text>
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						3 environments · 24 cores
					</Text>
				</View>
				<SampleUsageChart height={110} />
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
			<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
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
			</View>
			<Divider />
			<IconLabel title="Edit Tiles" icon="square.grid.2x2" color={m3.primary as string} />
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
			illustration={refreshedDashboardIllustration}
		/>
	);
}
