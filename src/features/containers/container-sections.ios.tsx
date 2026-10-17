/**
 * Ports of `ContainerPortsSection` and `ContainerHealthSection`, plus the
 * row helpers ContainerDetailView uses (`row`, `linkRow`, `detailSection`).
 *
 * SwiftUI-tree.
 */
import { Button, HStack, Label, LabeledContent, Section, Spacer, Text } from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	lineLimit,
	monospacedDigit,
	shapes,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { ContainerPort } from '@/sdk/models/container/Container';
import type { ContainerHealth } from '@/sdk/models/container/ContainerState';
import { systemColors } from '@/theme/colors';
import { DisclosureChevron } from '@/ui/settings-row';

import { healthPresentation, sortedPorts } from './container-detail-logic';

export function DetailSection({
	title,
	systemImage,
	children
}: {
	title: string;
	systemImage: string;
	children: ReactNode;
}) {
	return (
		<Section header={<Label title={title} systemImage={systemImage as SFSymbol} />}>
			{children}
		</Section>
	);
}

export function ValueRow({ label, children }: { label: string; children: ReactNode }) {
	return <LabeledContent label={label}>{children}</LabeledContent>;
}

export function LinkRow({
	title,
	systemImage,
	onPress
}: {
	title: string;
	systemImage: string;
	onPress: () => void;
}) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<Label title={title} systemImage={systemImage as SFSymbol} />
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

export function ContainerPortsSection({ ports }: { ports: ContainerPort[] }) {
	return (
		<Section
			header={<Text>Ports</Text>}
			footer={<Text>Active port mappings reported by the container.</Text>}
		>
			{sortedPorts(ports).map((port, index) => (
				<LabeledContent
					key={index}
					label={
						<Text
							modifiers={[font({ textStyle: 'body', design: 'monospaced' }), textSelection(true)]}
						>{`${port.privatePort}/${port.type}`}</Text>
					}
				>
					{port.publicPort !== undefined ? (
						<Text
							modifiers={[font({ textStyle: 'body', design: 'monospaced' }), textSelection(true)]}
						>
							{`${port.ip ? port.ip : '0.0.0.0'}:${port.publicPort}`}
						</Text>
					) : (
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							Internal
						</Text>
					)}
				</LabeledContent>
			))}
		</Section>
	);
}

export function ContainerHealthSection({
	health,
	onOpenHistory
}: {
	health: ContainerHealth;
	onOpenHistory: () => void;
}) {
	const p = healthPresentation(health.status);
	const color =
		p.color === 'green'
			? systemColors.green
			: p.color === 'red'
				? systemColors.red
				: p.color === 'orange'
					? systemColors.orange
					: 'secondary';
	return (
		<Section title="Health">
			<HStack spacing={12}>
				<Text>Status</Text>
				<Spacer minLength={16} />
				<Label
					title={p.displayStatus}
					systemImage={p.symbol as SFSymbol}
					modifiers={[foregroundStyle(color), lineLimit(1)]}
				/>
			</HStack>
			<HStack>
				<Text>Failing streak</Text>
				<Spacer minLength={16} />
				<Text
					modifiers={[
						monospacedDigit(),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{String(health.failingStreak)}
				</Text>
			</HStack>
			{health.log && health.log.length > 0 ? (
				<LinkRow
					title={`History (${health.log.length})`}
					systemImage="clock.arrow.circlepath"
					onPress={onOpenHistory}
				/>
			) : null}
		</Section>
	);
}
