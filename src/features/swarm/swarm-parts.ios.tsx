/**
 * Ports of `SwarmStateBadge`, `SwarmListState`, `SwarmKeyValueRows`
 * (SwarmCommon.swift) and the copyable ID row used by the swarm detail screens.
 *
 * SwiftUI-tree.
 */
import * as Clipboard from 'expo-clipboard';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContentUnavailableView,
	HStack,
	LabeledContent,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	buttonStyle,
	font,
	frame,
	multilineTextAlignment,
	textSelection
} from '@expo/ui/swift-ui/modifiers';

import type { SFSymbol } from 'sf-symbols-typescript';

import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { MonospacedValue } from '@/ui/components/resource-detail';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { showToast, Toasts } from '@/ui/toast';

import { shortID, swarmBadgeStatus, swarmStateLabel } from './swarm-common';
import type {
	CopyValueRowProps,
	SwarmKeyValueRowsProps,
	SwarmListStateProps,
	SwarmStateBadgeProps
} from './swarm-parts.types';

export function SwarmStateBadge({ state, usesCardStyle = true }: SwarmStateBadgeProps) {
	return (
		<ResourceStatusBadge
			status={swarmBadgeStatus(state)}
			isLive={false}
			usesCardStyle={usesCardStyle}
			label={swarmStateLabel(state)}
		/>
	);
}

export function SwarmListState({
	isLoading,
	isEmpty,
	errorMessage,
	emptyTitle,
	emptySystemImage,
	emptyDescription,
	retry,
	children
}: SwarmListStateProps) {
	if (isLoading && isEmpty) {
		return (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	}
	if (errorMessage !== undefined && isEmpty) {
		return (
			<UnavailableView
				title="Couldn't Load"
				systemImage="exclamationmark.triangle"
				description={errorMessage}
				actions={[{ title: 'Try Again', onPress: retry }]}
			/>
		);
	}
	if (isEmpty) {
		return (
			<ContentUnavailableView
				title={emptyTitle}
				systemImage={emptySystemImage as SFSymbol}
				description={emptyDescription}
			/>
		);
	}
	return <>{children}</>;
}

export function SwarmKeyValueRows({ pairs }: SwarmKeyValueRowsProps) {
	return (
		<>
			{pairs.map(([key, value], index) => (
				<LabeledContent key={index} label={key}>
					<Text
						modifiers={[
							font({ textStyle: 'callout', design: 'monospaced' }),
							multilineTextAlignment('trailing'),
							textSelection(true)
						]}
					>
						{value}
					</Text>
				</LabeledContent>
			))}
		</>
	);
}

export async function copyToClipboard(value: string) {
	await Clipboard.setStringAsync(value);
	showToast(Toasts.copied());
}

/** `copyRow(_:value:)`: the first 12 characters, tap to copy the full value. */
export function CopyValueRow({ title, value }: CopyValueRowProps) {
	return (
		<LabeledContent label={title}>
			<Button
				onPress={() => void copyToClipboard(value)}
				modifiers={[buttonStyle('borderless'), accessibilityLabel(`Copy ${title}`)]}
			>
				<HStack spacing={6}>
					<MonospacedValue value={shortID(value)} />
					<Image systemName="doc.on.doc" modifiers={[font({ textStyle: 'caption' })]} />
				</HStack>
			</Button>
		</LabeledContent>
	);
}
