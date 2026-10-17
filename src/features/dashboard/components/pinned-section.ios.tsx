/**
 * Port of `DashboardPinnedSection` (DashboardPinnedSection.swift): pinned
 * containers and projects for the active environment, each with a
 * start/stop quick action.
 *
 * SwiftUI-tree.
 */
import {
	Button,
	Circle,
	Divider,
	HStack,
	ProgressView,
	Spacer,
	Text,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	buttonStyle,
	contentShape,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	offset,
	padding,
	shapes,
	strokeBorder
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { ProjectDetails } from '@/sdk/models/project/Project';
import { systemColors, withOpacity } from '@/theme/colors';
import { groupedHex, useIsDark } from '@/ui/components/accessibility';
import { RowIcon } from '@/ui/components/row-icon';
import { cardRowLinkStyle } from '@/ui/components/swiftui-motion';
import { GlassCardBackground, glassEffectCompat } from '@/ui/components/swiftui-surfaces';

import { PinnedItem, useDashboardPinned, type DashboardPinnedItem } from '../use-dashboard-pinned';
import { DashboardRowChevron, DashboardSectionTitle } from './dashboard-parts';

export function DashboardPinnedSection({
	refreshToken,
	onOpenContainer,
	onOpenProject
}: {
	refreshToken: number;
	onOpenContainer: (container: ContainerSummary) => void;
	onOpenProject: (project: ProjectDetails) => void;
}) {
	const { items, isLoading, runningID, runAction } = useDashboardPinned(refreshToken);
	const isDark = useIsDark();

	const open = (item: DashboardPinnedItem) =>
		item.kind === 'container' ? onOpenContainer(item.container) : onOpenProject(item.project);

	return (
		<VStack alignment="leading" spacing={12}>
			<HStack alignment="firstTextBaseline">
				<DashboardSectionTitle title="Pinned" />
				<Spacer />
				{isLoading && items.length > 0 ? <ProgressView modifiers={[controlSize('small')]} /> : null}
			</HStack>
			<GlassCardBackground key={`pinned.rows.${items.length}`}>
				<VStack spacing={0}>
					{items.length === 0 ? (
						<HStack
							spacing={10}
							modifiers={[
								padding({ all: 16 }),
								frame({ maxWidth: Infinity, alignment: 'leading' })
							]}
						>
							{isLoading ? <ProgressView modifiers={[controlSize('small')]} /> : null}
							<Text
								modifiers={[
									font({ textStyle: 'subheadline' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{isLoading
									? 'Loading pinned items…'
									: 'Pinned items are unavailable in this environment.'}
							</Text>
						</HStack>
					) : (
						items.map((item, index) => {
							const id = PinnedItem.id(item);
							const title = PinnedItem.title(item);
							const status = PinnedItem.status(item);
							const running = PinnedItem.isRunning(item);
							return (
								<VStack key={id} spacing={0}>
									<HStack spacing={8} modifiers={[padding({ horizontal: 16, vertical: 10 })]}>
										<Button onPress={() => open(item)} modifiers={[cardRowLinkStyle()]}>
											<HStack
												spacing={12}
												modifiers={[
													frame({ maxWidth: Infinity, alignment: 'leading' }),
													contentShape(shapes.rectangle()),
													accessibilityElement('ignore'),
													accessibilityLabel(`${title}: ${status}`),
													accessibilityAddTraits(['isButton'])
												]}
											>
												<ZStack alignment="bottomTrailing" modifiers={[accessibilityHidden(true)]}>
													<RowIcon
														systemImage={PinnedItem.icon(item)}
														tint={PinnedItem.tint(item)}
														size={30}
													/>
													<Circle
														modifiers={[
															foregroundStyle(
																running ? systemColors.green : withOpacity('#8E8E93', 0.5)
															),
															frame({ width: 9, height: 9 }),
															strokeBorder({
																color:
																	groupedHex[isDark ? 'dark' : 'light']
																		.secondarySystemGroupedBackground,
																style: { lineWidth: 1.5 },
																shape: 'circle'
															}),
															offset({ x: 2, y: 2 })
														]}
													/>
												</ZStack>
												<VStack alignment="leading" spacing={3}>
													<Text
														modifiers={[
															font({ textStyle: 'subheadline', weight: 'medium' }),
															foregroundStyle('primary'),
															lineLimit(1)
														]}
													>
														{title}
													</Text>
													<Text
														modifiers={[
															font({ textStyle: 'caption' }),
															foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
															lineLimit(1)
														]}
													>
														{status}
													</Text>
												</VStack>
												<Spacer minLength={8} />
												<DashboardRowChevron />
											</HStack>
										</Button>
										<Button
											onPress={() => void runAction(item)}
											modifiers={[
												buttonStyle('borderless'),
												glassEffectCompat({ interactive: true, shape: 'circle' }),
												disabled(runningID !== undefined),
												accessibilityLabel(PinnedItem.actionTitle(item))
											]}
										>
											<ZStack
												modifiers={[
													frame({ width: 32, height: 32 }),
													contentShape(shapes.circle())
												]}
											>
												{runningID === id ? (
													<ProgressView modifiers={[controlSize('small')]} />
												) : (
													<Image
														systemName={PinnedItem.actionSystemImage(item) as SFSymbol}
														modifiers={[
															font({ size: 14, weight: 'semibold' }),
															foregroundStyle(PinnedItem.actionTint(item))
														]}
													/>
												)}
											</ZStack>
										</Button>
									</HStack>
									{index < items.length - 1 ? (
										<Divider modifiers={[padding({ leading: 58 })]} />
									) : null}
								</VStack>
							);
						})
					)}
				</VStack>
			</GlassCardBackground>
		</VStack>
	);
}
