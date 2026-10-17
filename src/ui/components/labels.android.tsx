import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import {
	resourceCountText,
	updateStatePresentation,
	type DestructiveLabelProps,
	type ImageUpdateState,
	type ResourceCountProps,
	type SectionHeaderProps
} from './labels.types';
import { m3 } from './material-colors';
import { m3Type } from './type-scale';

export function ResourceCountLabel(props: ResourceCountProps) {
	const { text, accessibility } = resourceCountText(props);
	return (
		<Text
			accessibilityLabel={accessibility}
			style={[m3Type.labelMedium, { color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }]}
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
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				paddingHorizontal: 16,
				paddingTop: 20,
				paddingBottom: 6
			}}
		>
			<Text
				accessibilityRole="header"
				style={[m3Type.titleSmall, { flex: 1, color: colors.secondaryLabel }]}
			>
				{title}
			</Text>
			<ResourceCountLabel {...count} />
		</View>
	);
}

export function SectionHeader({ title, systemImage, count, trailing }: SectionHeaderProps) {
	return (
		<View
			accessible
			accessibilityRole="header"
			style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}
		>
			{systemImage ? <Icon name={systemImage} size={18} color={colors.secondaryLabel} /> : null}
			<Text style={[m3Type.titleMedium, { color: colors.secondaryLabel }]}>{title}</Text>
			{count !== undefined ? (
				<Text
					style={[
						m3Type.titleMedium,
						{ color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] }
					]}
				>
					{String(count)}
				</Text>
			) : null}
			<View style={{ flex: 1, minWidth: 8 }} />
			{trailing}
		</View>
	);
}

export function UpdateStateBadge({ state }: { state: ImageUpdateState }) {
	const p = updateStatePresentation(state);
	const color = p.color ?? colors.secondaryLabel;
	return (
		<View
			accessible
			accessibilityLabel={p.accessibility}
			style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
		>
			<Icon name={p.symbol} size={16} color={color} />
			<Text style={[m3Type.bodyMedium, { color }]}>{p.title}</Text>
		</View>
	);
}

export function DestructiveLabel({ text, systemImage = 'trash' }: DestructiveLabelProps) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<Icon name={systemImage} size={24} color={m3.error} />
			<Text style={[m3Type.bodyLarge, { color: m3.error }]}>{text}</Text>
		</View>
	);
}
