import { HStack, Label, Spacer, Text } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	contentTransition,
	fixedSize,
	font,
	foregroundStyle,
	monospacedDigit,
	padding
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';

import { useReduceMotion } from './accessibility';
import {
	resourceCountText,
	updateStatePresentation,
	type DestructiveLabelProps,
	type ImageUpdateState,
	type ResourceCountProps,
	type SectionHeaderProps
} from './labels.types';
import { hashKey, motionAwareAnimation } from './swiftui-motion';
import { symbolRenderingMode } from '../../../modules/arcane-swiftui-extras';

export function ResourceCountLabel(props: ResourceCountProps) {
	const { text, accessibility } = resourceCountText(props);
	return (
		<Text
			modifiers={[
				font({ textStyle: 'subheadline' }),
				monospacedDigit(),
				foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
				accessibilityElement('ignore'),
				accessibilityLabel(accessibility)
			]}
		>
			{text}
		</Text>
	);
}

export function ResourceCountSectionHeader({
	title,
	...count
}: ResourceCountProps & { title: string }) {
	return (
		<HStack>
			<Text>{title}</Text>
			<Spacer />
			<ResourceCountLabel {...count} />
		</HStack>
	);
}

export function SectionHeader({ title, systemImage, count, trailing }: SectionHeaderProps) {
	return (
		<HStack spacing={6} modifiers={[padding({ horizontal: 4 }), accessibilityElement('combine')]}>
			{systemImage ? (
				<Image
					systemName={systemImage as SFSymbol}
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'semibold' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						accessibilityHidden(true)
					]}
				/>
			) : null}
			<Text
				modifiers={[
					font({ textStyle: 'headline' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{title}
			</Text>
			{count !== undefined ? (
				<Text
					modifiers={[
						font({ textStyle: 'headline' }),
						monospacedDigit(),
						foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
					]}
				>
					{String(count)}
				</Text>
			) : null}
			<Spacer minLength={8} />
			{trailing}
		</HStack>
	);
}

export function UpdateStateBadge({ state }: { state: ImageUpdateState }) {
	const reduceMotion = useReduceMotion();
	const p = updateStatePresentation(state);
	return (
		<HStack
			spacing={4}
			modifiers={[
				font({ textStyle: 'subheadline' }),
				foregroundStyle(p.color ?? 'secondary'),
				fixedSize({ horizontal: false, vertical: true }),
				...motionAwareAnimation(Motion.state, hashKey(state.kind), reduceMotion),
				accessibilityElement('ignore'),
				accessibilityLabel(p.accessibility)
			]}
		>
			<Image systemName={p.symbol as SFSymbol} modifiers={[contentTransition('opacity')]} />
			<Text modifiers={[contentTransition('opacity')]}>{p.title}</Text>
		</HStack>
	);
}

export function DestructiveLabel({ text, systemImage = 'trash' }: DestructiveLabelProps) {
	return (
		<Label
			title={text}
			systemImage={systemImage as SFSymbol}
			color={systemColors.red}
			modifiers={[symbolRenderingMode('monochrome'), foregroundStyle(systemColors.red)]}
		/>
	);
}
