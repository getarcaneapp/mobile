import { HStack, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	font,
	foregroundStyle,
	frame,
	progressViewStyle,
	tint as tintModifier
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { Activity } from '@/sdk/models/activity/Activity';

import { ActivityDisplay, type ActivityTint } from './activity-display';

type SwiftStyle = string | { type: 'hierarchical'; style: 'secondary' | 'tertiary' };

export function swiftTint(tint: ActivityTint): SwiftStyle {
	return tint === 'secondary' ? { type: 'hierarchical', style: 'secondary' } : tint;
}

export function ActivityProgressView({
	progress,
	isActive,
	tint,
	showsPercentage = false
}: {
	progress: number | undefined;
	isActive: boolean;
	tint: ActivityTint;
	showsPercentage?: boolean;
}) {
	if (progress !== undefined) {
		if (showsPercentage) {
			return (
				<VStack
					alignment="leading"
					spacing={4}
					modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
				>
					<ProgressView
						value={progress / 100}
						modifiers={[progressViewStyle('linear'), tintModifier(swiftTint(tint))]}
					>
						<Text>Progress</Text>
					</ProgressView>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>{`${progress}%`}</Text>
				</VStack>
			);
		}
		return (
			<ProgressView
				value={progress / 100}
				modifiers={[progressViewStyle('linear'), tintModifier(swiftTint(tint))]}
			/>
		);
	}
	if (isActive) {
		return (
			<HStack modifiers={[accessibilityElement('combine')]}>
				<ProgressView modifiers={[tintModifier(swiftTint(tint))]} />
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					In progress
				</Text>
			</HStack>
		);
	}
	return null;
}

export function ActivitySymbol({ systemName, tint }: { systemName: string; tint: ActivityTint }) {
	return (
		<Image
			systemName={systemName as SFSymbol}
			modifiers={[
				font({ textStyle: 'callout', weight: 'semibold' }),
				foregroundStyle(swiftTint(tint)),
				frame({ width: 28 }),
				accessibilityHidden(true)
			]}
		/>
	);
}

export function ActivityIcon({ activity }: { activity: Activity }) {
	return (
		<ActivitySymbol
			systemName={ActivityDisplay.typeIcon(activity)}
			tint={ActivityDisplay.statusTint(activity)}
		/>
	);
}
