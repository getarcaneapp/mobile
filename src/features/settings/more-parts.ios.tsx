import { Button, Grid, HStack, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
	accessibilityHint,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listRowBackground,
	listRowInsets,
	minimumScaleFactor,
	padding,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { iconColor, systemImage, tabBarTitle, tabTitle, type AppTab } from '@/core/app-tab';
import { systemColors } from '@/theme/colors';
import { Image } from '@/ui/components/swiftui-image';
import { DashboardCardBackground } from '@/ui/components/swiftui-surfaces';
import { DisclosureChevron, SettingsRow } from '@/ui/settings-row';

import { tileRows, type MoreDestinationGroup } from './more-groups';

function DestinationTile({ tab, onPress }: { tab: AppTab | undefined; onPress: () => void }) {
	if (tab === undefined) return <Spacer modifiers={[frame({ maxWidth: Infinity })]} />;
	return (
		<Button
			onPress={onPress}
			modifiers={[buttonStyle('plain'), accessibilityHint(`Opens ${tabTitle[tab]}`)]}
		>
			<DashboardCardBackground>
				<VStack
					spacing={8}
					modifiers={[
						frame({ maxWidth: Infinity, minHeight: 56 }),
						padding({ vertical: 14, horizontal: 6 }),
						contentShape(shapes.rectangle())
					]}
				>
					<Image
						systemName={systemImage[tab] as SFSymbol}
						modifiers={[
							font({ textStyle: 'title2' }),
							foregroundStyle(systemColors[iconColor(tab)]),
							frame({ height: 30 })
						]}
					/>
					<Text
						modifiers={[
							font({ textStyle: 'footnote', weight: 'medium' }),
							lineLimit(1),
							minimumScaleFactor(0.75)
						]}
					>
						{tabBarTitle(tab)}
					</Text>
				</VStack>
			</DashboardCardBackground>
		</Button>
	);
}

export function TileSection({
	group,
	onOpen
}: {
	group: MoreDestinationGroup;
	onOpen: (tab: AppTab) => void;
}) {
	return (
		<Section title={group.title}>
			<Grid
				horizontalSpacing={10}
				verticalSpacing={10}
				modifiers={[
					frame({ maxWidth: Infinity }),
					listRowBackground('clear'),
					listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 })
				]}
			>
				{tileRows(group.tabs).map((row, rowIndex) => (
					<Grid.Row key={rowIndex}>
						{row.map((tab, index) => (
							<DestinationTile
								key={tab ?? `empty-${index}`}
								tab={tab}
								onPress={() => (tab ? onOpen(tab) : undefined)}
							/>
						))}
					</Grid.Row>
				))}
			</Grid>
		</Section>
	);
}

function DestinationRow({
	tab,
	isTab,
	onPress
}: {
	tab: AppTab;
	isTab: boolean;
	onPress: () => void;
}) {
	return (
		<Button
			onPress={onPress}
			modifiers={[
				buttonStyle('plain'),
				accessibilityHint(isTab ? `Switches to the ${tabTitle[tab]} tab` : `Opens ${tabTitle[tab]}`)
			]}
		>
			<HStack
				modifiers={[
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					contentShape(shapes.rectangle())
				]}
			>
				<SettingsRow
					title={tabTitle[tab]}
					systemImage={systemImage[tab]}
					color={systemColors[iconColor(tab)]}
				/>
				<Spacer />
				{isTab ? (
					<>
						<Text
							modifiers={[
								font({ textStyle: 'caption', weight: 'semibold' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							Tab
						</Text>
						<Image
							systemName="arrow.turn.down.left"
							modifiers={[
								font({ textStyle: 'caption', weight: 'semibold' }),
								foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
							]}
						/>
					</>
				) : (
					<DisclosureChevron />
				)}
			</HStack>
		</Button>
	);
}

export function DestinationRowGroup({
	group,
	visibleTabs,
	onOpen
}: {
	group: MoreDestinationGroup;
	visibleTabs: ReadonlySet<AppTab>;
	onOpen: (tab: AppTab) => void;
}) {
	return (
		<Section title={group.title}>
			{group.tabs.map((tab) => (
				<DestinationRow
					key={tab}
					tab={tab}
					isTab={visibleTabs.has(tab)}
					onPress={() => onOpen(tab)}
				/>
			))}
		</Section>
	);
}

export function LinkRow({
	title,
	symbol,
	color,
	onPress
}: {
	title: string;
	symbol: string;
	color: string;
	onPress: () => void;
}) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<SettingsRow title={title} systemImage={symbol} color={color} />
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}
