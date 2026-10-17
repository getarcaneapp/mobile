/**
 * Ports of NeedsAttentionSection.swift: `AttentionToolbarButton` (badge +
 * severity tint; tap → summary popover, long press → Attention Center),
 * `AttentionSummaryPopover`, `AttentionItemRow`, and `AttentionCenterView`.
 *
 * `AttentionToolbarButton` is Standalone (its own Host, for a
 * `Stack.Toolbar.View`); the rest are SwiftUI-tree.
 */
import { Host } from '@/ui/host';
import {
	BottomSheet,
	Button,
	ContentUnavailableView,
	Divider,
	HStack,
	List,
	NavigationStack,
	Popover,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityElement,
	accessibilityHint,
	accessibilityLabel,
	background,
	contentShape,
	contentTransition,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	monospacedDigit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	onLongPressGesture,
	onTapGesture,
	padding,
	presentationDetents,
	presentationDragIndicator,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';
import { cardRowLinkStyle, StaggeredReveal } from '@/ui/components/swiftui-motion';

import {
	attentionButtonAppearance,
	severityTitle,
	type NeedsAttentionItem
} from '../dashboard-logic';
import { DashboardRowChevron } from './dashboard-parts';
import { symbolRenderingMode } from '../../../../modules/arcane-swiftui-extras';

/** Swift's `.secondary` is hierarchical: inside a tinted Button / toolbar popover it follows the accent foreground. */
const hierarchicalSecondary = { type: 'hierarchical', style: 'secondary' } as const;

const severityTint = (item: NeedsAttentionItem) =>
	item.severity === 'critical' ? systemColors.red : systemColors.orange;

/** Icon disc, title (+ optional detail), count pill, chevron. */
export function AttentionItemRow({
	item,
	showsDetail = false
}: {
	item: NeedsAttentionItem;
	showsDetail?: boolean;
}) {
	const tint = severityTint(item);
	return (
		<HStack
			spacing={12}
			modifiers={[
				accessibilityElement('ignore'),
				accessibilityLabel(`${item.title}: ${item.count}`),
				accessibilityAddTraits(['isButton'])
			]}
		>
			<RowIcon systemImage={item.icon} tint={tint} size={30} changeToken={String(item.count)} />
			<VStack alignment="leading" spacing={2}>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'medium' }),
						foregroundStyle('primary'),
						lineLimit(1)
					]}
				>
					{item.title}
				</Text>
				{showsDetail ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle(hierarchicalSecondary),
							fixedSize({ horizontal: false, vertical: true })
						]}
					>
						{item.detail}
					</Text>
				) : null}
			</VStack>
			<Spacer minLength={8} />
			<Text
				modifiers={[
					font({ textStyle: 'caption', weight: 'semibold' }),
					monospacedDigit(),
					foregroundStyle(tint),
					padding({ horizontal: 8, vertical: 3 }),
					background(withOpacity(tint, 0.14), shapes.capsule()),
					contentTransition('numericText')
				]}
			>
				{String(item.count)}
			</Text>
			<DashboardRowChevron />
		</HStack>
	);
}

const maximumRows = 4;

/** Compact summary that expands out of the toolbar button. */
function AttentionSummaryPopover({
	items,
	onSelect
}: {
	items: NeedsAttentionItem[];
	onSelect: (item: NeedsAttentionItem) => void;
}) {
	const accent = useAccentColor();
	const visible = items.slice(0, maximumRows);
	// Swift's popover hangs off a toolbar item, so its content inherits the
	// toolbar's accent foreground: the title, "N items", and the hierarchical
	// chevrons render accent-tinted (row titles stay `.primary`).
	return (
		<VStack
			alignment="leading"
			spacing={0}
			modifiers={[
				foregroundStyle(accent),
				padding({ bottom: 6 }),
				frame({ idealWidth: 320, maxWidth: 340, alignment: 'leading' })
			]}
		>
			<HStack
				alignment="firstTextBaseline"
				modifiers={[padding({ leading: 16, trailing: 16, top: 14, bottom: 6 })]}
			>
				<Text modifiers={[font({ textStyle: 'headline' })]}>Needs Attention</Text>
				<Spacer />
				<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(hierarchicalSecondary)]}>
					{items.length === 0 ? 'All clear' : `${items.length} items`}
				</Text>
			</HStack>
			{items.length === 0 ? (
				<HStack spacing={6} modifiers={[padding({ horizontal: 16, vertical: 10 })]}>
					<Image
						systemName="checkmark.circle.fill"
						modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(hierarchicalSecondary)]}
					/>
					<Text
						modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(hierarchicalSecondary)]}
					>
						Everything looks healthy.
					</Text>
				</HStack>
			) : (
				<VStack spacing={0}>
					{visible.map((item, index) => (
						<VStack key={item.id} spacing={0}>
							<StaggeredReveal index={index}>
								<Button onPress={() => onSelect(item)} modifiers={[cardRowLinkStyle()]}>
									<HStack
										modifiers={[
											padding({ horizontal: 16, vertical: 9 }),
											contentShape(shapes.rectangle())
										]}
									>
										<AttentionItemRow item={item} />
									</HStack>
								</Button>
							</StaggeredReveal>
							{index < visible.length - 1 ? (
								<Divider modifiers={[padding({ leading: 58 })]} />
							) : null}
						</VStack>
					))}
					{items.length > visible.length ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle(hierarchicalSecondary),
								padding({ horizontal: 16, vertical: 8 })
							]}
						>
							{`${items.length - visible.length} more in the Attention Center`}
						</Text>
					) : null}
				</VStack>
			)}
		</VStack>
	);
}

/**
 * Top-left toolbar entry point. Badge carries the item count, the glyph tint
 * follows the highest severity. Tap: summary popover. Long press: Attention Center.
 */
export function AttentionToolbarButton({
	items,
	isPresented,
	setPresented,
	onSelect,
	onOpenCenter
}: {
	items: NeedsAttentionItem[];
	isPresented: boolean;
	setPresented: (value: boolean) => void;
	onSelect: (item: NeedsAttentionItem) => void;
	onOpenCenter: () => void;
}) {
	const { symbol, tint } = attentionButtonAppearance(items);
	return (
		<Host matchContents>
			<Popover isPresented={isPresented} onIsPresentedChange={setPresented} arrowEdge="top">
				<Popover.Trigger>
					{/* Swift: Button + simultaneousGesture(LongPress). Expo's onLongPressGesture on a
              Button never wins over the tap, so a plain view takes both gestures (hold: center). */}
					<ZStack
						modifiers={[
							contentShape(shapes.rectangle()),
							onLongPressGesture(() => {
								void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
								setPresented(false);
								onOpenCenter();
							}, 0.4),
							// A completed hold never also fires the tap, so no swallow flag is needed.
							onTapGesture(() => setPresented(true)),
							accessibilityElement('combine'),
							accessibilityAddTraits(['isButton']),
							accessibilityLabel(
								items.length === 0
									? 'Attention Center, all clear'
									: `Attention Center, ${items.length} items`
							),
							accessibilityHint('Tap for a summary. Hold to open the Attention Center.')
						]}
					>
						<ZStack alignment="topTrailing" modifiers={[frame({ width: 36, height: 36 })]}>
							<Image
								systemName={symbol as SFSymbol}
								modifiers={[
									font({ size: 17, weight: 'medium' }),
									symbolRenderingMode('hierarchical'),
									foregroundStyle(systemColors[tint]),
									contentTransition('interpolate'),
									frame({ width: 32, height: 32 })
								]}
							/>
							{items.length > 0 ? (
								<Text
									modifiers={[
										font({ textStyle: 'caption2', weight: 'bold' }),
										foregroundStyle('white'),
										padding({ horizontal: 4 }),
										frame({ minWidth: 16, minHeight: 16 }),
										background(systemColors.red, shapes.capsule())
									]}
								>
									{String(items.length)}
								</Text>
							) : null}
						</ZStack>
					</ZStack>
				</Popover.Trigger>
				<Popover.Content>
					<AttentionSummaryPopover items={items} onSelect={onSelect} />
				</Popover.Content>
			</Popover>
		</Host>
	);
}

/** Full Attention Center: every item grouped by severity, with its detail. */
export function AttentionCenterSheet({
	isPresented,
	items,
	onSelect,
	onDismiss
}: {
	isPresented: boolean;
	items: NeedsAttentionItem[];
	onSelect: (item: NeedsAttentionItem) => void;
	onDismiss: () => void;
}) {
	const accent = useAccentColor();
	const critical = items.filter((i) => i.severity === 'critical');
	const warnings = items.filter((i) => i.severity === 'warning');
	const row = (item: NeedsAttentionItem) => (
		<Button key={item.id} onPress={() => onSelect(item)}>
			<HStack modifiers={[padding({ vertical: 2 })]}>
				<AttentionItemRow item={item} showsDetail />
			</HStack>
		</Button>
	);
	return (
		<BottomSheet isPresented={isPresented} onIsPresentedChange={(value) => !value && onDismiss()}>
			<NavigationStack
				modifiers={[presentationDetents(['medium', 'large']), presentationDragIndicator('visible')]}
			>
				<Toolbar
					modifiers={[navigationTitle('Attention Center'), navigationBarTitleDisplayMode('inline')]}
				>
					{items.length === 0 ? (
						<ContentUnavailableView
							title="All Clear"
							systemImage="checkmark.shield.fill"
							description="Nothing needs your attention right now."
						/>
					) : (
						<List modifiers={[listStyle('insetGrouped')]}>
							{critical.length > 0 ? (
								<Section title={severityTitle.critical}>{critical.map(row)}</Section>
							) : null}
							{warnings.length > 0 ? (
								<Section title={severityTitle.warning}>{warnings.map(row)}</Section>
							) : null}
						</List>
					)}
					<Toolbar.Content>
						<ToolbarItem placement="confirmationAction">
							<Button label="Done" onPress={onDismiss} modifiers={[foregroundStyle(accent)]} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</BottomSheet>
	);
}
