/**
 * Port of `EnvironmentListRow` (EnvironmentsView.swift): one environment card
 * on the classic dashboard: status dot, name, icon + count pairs, version
 * line, and CPU / memory / disk rings, with a long-press action menu.
 *
 * SwiftUI-tree.
 */
import {
	Button,
	ContextMenu,
	Divider,
	HStack,
	Overlay,
	RNHostView,
	RoundedRectangle,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityHint,
	accessibilityLabel,
	accessibilityValue,
	contentShape,
	contentTransition,
	disabled,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	monospacedDigit,
	padding,
	shapes,
	strokeBorder,
	truncationMode,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { parseHex, systemColors } from '@/theme/colors';
import { Motion, Radius } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';
import { cardRowLinkStyle, hashKey, motionAwareAnimation } from '@/ui/components/swiftui-motion';
import { DestructiveLabel } from '@/ui/components/labels';
import { GlassCardBackground } from '@/ui/components/swiftui-surfaces';

import type { EnvironmentRowProps } from './environment-row.types';
import { MetricRing } from './metric-ring';
import { revealedEnvironmentIDs, ringValueText, useEnvironmentRow } from '../use-environment-row';

const statusColors = {
	orange: systemColors.orange,
	secondary: 'secondary',
	green: systemColors.green
} as const;

function Count({
	value,
	systemImage,
	tint,
	label,
	highlight
}: {
	value: string;
	systemImage: string;
	tint: string;
	label: string;
	highlight?: string;
}) {
	const reduceMotion = useReduceMotion();
	return (
		<HStack
			spacing={4}
			modifiers={[accessibilityElement('ignore'), accessibilityLabel(`${label}: ${value}`)]}
		>
			<Image
				systemName={systemImage as SFSymbol}
				modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(tint)]}
			/>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					monospacedDigit(),
					foregroundStyle(highlight ?? 'primary'),
					contentTransition('numericText'),
					...motionAwareAnimation(Motion.state, hashKey(value), reduceMotion)
				]}
			>
				{value}
			</Text>
		</HStack>
	);
}

function RingGauge({
	title,
	percent,
	tint,
	revealed
}: {
	title: string;
	percent: number | undefined;
	tint: string;
	revealed: boolean;
}) {
	const value = Math.min(Math.max(percent ?? 0, 0), 100);
	const valueText = ringValueText(percent);
	return (
		<HStack
			spacing={7}
			modifiers={[
				fixedSize(),
				accessibilityElement('ignore'),
				accessibilityLabel(title),
				accessibilityValue(percent === undefined ? 'Unavailable' : `${Math.round(percent)} percent`)
			]}
		>
			<HStack modifiers={[frame({ width: 18, height: 18 })]}>
				<RNHostView matchContents>
					<View>
						<MetricRing
							progress={(revealed ? value : 0) / 100}
							tint={tint}
							size={18}
							lineWidth={3}
						/>
					</View>
				</RNHostView>
			</HStack>
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{title}
			</Text>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					monospacedDigit(),
					foregroundStyle('primary'),
					contentTransition('numericText')
				]}
			>
				{valueText}
			</Text>
		</HStack>
	);
}

export function EnvironmentRow(props: EnvironmentRowProps) {
	const { environment, dockerInfo, isActive, allEnvironmentsPreview, onOpen, onRefresh } = props;
	const row = useEnvironmentRow(environment, dockerInfo, onRefresh);
	const name = environment.name ?? environment.id;
	// Rings sweep in from empty once per environment per session.
	const [revealed] = useState(() => {
		const seen = revealedEnvironmentIDs.has(environment.id);
		revealedEnvironmentIDs.add(environment.id);
		return seen;
	});
	const [gaugesRevealed, setGaugesRevealed] = useState(revealed);
	useEffect(() => {
		if (gaugesRevealed) return;
		const timer = setTimeout(() => setGaugesRevealed(true), 200);
		return () => clearTimeout(timer);
	}, [gaugesRevealed]);
	const borderColor = allEnvironmentsPreview && row.colorHex ? parseHex(row.colorHex) : undefined;

	const card = (
		<GlassCardBackground isHighlighted={isActive && !allEnvironmentsPreview}>
			<Button
				onPress={onOpen}
				modifiers={[
					cardRowLinkStyle(),
					accessibilityHint('Opens system details. Hold for actions.')
				]}
			>
				<VStack
					alignment="leading"
					spacing={16}
					modifiers={[
						padding({ all: 16 }),
						frame({ maxWidth: Infinity, alignment: 'leading' }),
						contentShape(shapes.rectangle())
					]}
				>
					<VStack
						alignment="leading"
						spacing={4}
						modifiers={[
							accessibilityElement('combine'),
							accessibilityLabel(`${name}, ${row.subtitle}`)
						]}
					>
						<HStack alignment="firstTextBaseline" spacing={10}>
							<Image
								systemName="circle.fill"
								modifiers={[
									font({ size: 8 }),
									foregroundStyle(statusColors[row.statusTint]),
									accessibilityHidden(true)
								]}
							/>
							<Text
								modifiers={[
									font({ textStyle: 'headline' }),
									foregroundStyle('primary'),
									lineLimit(1),
									truncationMode('middle')
								]}
							>
								{name}
							</Text>
							<Spacer minLength={10} />
							<HStack spacing={10} modifiers={[fixedSize()]}>
								<Count
									value={row.updatesText}
									systemImage="arrow.triangle.2.circlepath"
									tint={systemColors.green}
									label="Updates"
								/>
								<Count
									value={row.containersText}
									systemImage="cube.box.fill"
									tint={systemColors.orange}
									label="Containers"
								/>
								<Count
									value={row.imagesText}
									systemImage="square.3.layers.3d.top.filled"
									tint={systemColors.purple}
									label="Images"
								/>
								<Count
									value={row.vulnerabilitiesText}
									systemImage="exclamationmark.shield.fill"
									tint={row.vulnerabilities > 0 ? systemColors.red : '#8E8E93'}
									label="Vulnerabilities"
									highlight={row.vulnerabilities > 0 ? systemColors.red : undefined}
								/>
							</HStack>
						</HStack>
						<HStack spacing={8} modifiers={[padding({ leading: 18 })]}>
							<Text
								modifiers={[
									font({ textStyle: 'caption', design: 'monospaced' }),
									foregroundStyle(row.streamError ? systemColors.orange : 'secondary'),
									lineLimit(1)
								]}
							>
								{row.subtitle}
							</Text>
							{row.isSyncing ? (
								<Image
									systemName="arrow.triangle.2.circlepath"
									modifiers={[
										font({ textStyle: 'caption', weight: 'semibold' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
										accessibilityLabel('Syncing')
									]}
								/>
							) : null}
						</HStack>
					</VStack>
					<HStack spacing={0}>
						<RingGauge
							title="CPU"
							percent={row.cpuPercent}
							tint={systemColors.blue}
							revealed={gaugesRevealed}
						/>
						<Spacer minLength={12} />
						<RingGauge
							title="Memory"
							percent={row.memoryPercent}
							tint={systemColors.purple}
							revealed={gaugesRevealed}
						/>
						<Spacer minLength={12} />
						<RingGauge
							title="Disk"
							percent={row.diskPercent}
							tint={systemColors.teal}
							revealed={gaugesRevealed}
						/>
					</HStack>
				</VStack>
			</Button>
		</GlassCardBackground>
	);

	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				{borderColor ? (
					<Overlay>
						{card}
						<Overlay.Content>
							<RoundedRectangle
								cornerRadius={Radius.card}
								modifiers={[
									foregroundStyle('#00000000'),
									strokeBorder({
										color: borderColor,
										style: { lineWidth: 1.5 },
										shape: 'roundedRectangle',
										cornerRadius: Radius.card
									})
								]}
							/>
						</Overlay.Content>
					</Overlay>
				) : (
					card
				)}
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{allEnvironmentsPreview ? (
					<Button label="Environment Color" systemImage="paintpalette" onPress={props.onColor} />
				) : null}
				{!isActive && !allEnvironmentsPreview ? (
					<Button
						label="Use Environment"
						systemImage="checkmark.circle"
						onPress={props.onUseEnvironment}
					/>
				) : null}
				<Button label="View Details" systemImage="info.circle" onPress={onOpen} />
				<Divider />
				<Button
					label="Sync"
					systemImage="arrow.triangle.2.circlepath"
					onPress={() => void row.sync()}
					modifiers={[disabled(row.isSyncing)]}
				/>
				{row.canUpgrade ? (
					<Button label="Upgrade Arcane" systemImage="arrow.up.circle" onPress={props.onUpgrade} />
				) : null}
				{row.canPrune ? (
					<Button onPress={props.onPrune} modifiers={[tint(systemColors.red)]}>
						<DestructiveLabel text="System Prune" />
					</Button>
				) : null}
			</ContextMenu.Items>
		</ContextMenu>
	);
}
