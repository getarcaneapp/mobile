import { Background, Overlay, RoundedRectangle } from '@expo/ui/swift-ui';
import {
	background,
	foregroundStyle,
	glassEffect,
	shadow,
	shapes,
	strokeBorder,
	type ModifierConfig,
	type Shape
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';

import { groupedHex, useIsDark, useReduceTransparency } from './accessibility';

export const isIOS26 = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;

type GlassShape = 'circle' | 'capsule' | 'rectangle' | 'roundedRectangle';

const glassShapeOf = (shape: GlassShape, cornerRadius?: number): Shape =>
	shape === 'circle'
		? shapes.circle()
		: shape === 'capsule'
			? shapes.capsule()
			: shape === 'rectangle'
				? shapes.rectangle()
				: shapes.roundedRectangle({ cornerRadius, roundedCornerStyle: 'continuous' });

export function glassEffectCompat({
	tint,
	interactive,
	shape = 'capsule',
	cornerRadius
}: {
	tint?: string;
	interactive?: boolean;
	shape?: GlassShape;
	cornerRadius?: number;
} = {}): ModifierConfig {
	if (isIOS26) {
		return glassEffect({ glass: { variant: 'regular', tint, interactive }, shape, cornerRadius });
	}
	return tint
		? background(withOpacity(tint, 0.15), glassShapeOf(shape, cornerRadius))
		: background({ type: 'material', material: 'regular' }, glassShapeOf(shape, cornerRadius));
}

export function glassChipCompat({
	tint,
	interactive,
	shape = 'circle',
	cornerRadius
}: {
	tint: string;
	interactive?: boolean;
	shape?: GlassShape;
	cornerRadius?: number;
}): ModifierConfig {
	return isIOS26
		? glassEffect({ glass: { variant: 'regular', tint, interactive }, shape, cornerRadius })
		: background(tint, glassShapeOf(shape, cornerRadius));
}

export const floatingSurfaceShadow = (): ModifierConfig =>
	shadow({ color: '#0000002E', radius: 12, y: 4 });

export function RaisedChipBackground({
	cornerRadius = Radius.nested,
	children
}: {
	cornerRadius?: number;
	children: ReactNode;
}) {
	return (
		<Background>
			{children}
			<Background.Content>
				<RoundedRectangle
					cornerRadius={cornerRadius}
					modifiers={[
						foregroundStyle(colors.tertiarySystemGroupedBackground),
						shadow({ color: '#00000026', radius: 3, y: 1 })
					]}
				/>
			</Background.Content>
		</Background>
	);
}

export function DashboardCardBackground({
	cornerRadius = Radius.card,
	children
}: {
	cornerRadius?: number;
	children: ReactNode;
}) {
	const isDark = useIsDark();
	if (isIOS26) {
		return (
			<Background>
				{children}
				<Background.Content>
					<RoundedRectangle
						cornerRadius={cornerRadius}
						modifiers={[foregroundStyle(colors.secondarySystemGroupedBackground)]}
					/>
				</Background.Content>
			</Background>
		);
	}
	return (
		<Overlay>
			<Background>
				{children}
				<Background.Content>
					<RoundedRectangle
						cornerRadius={cornerRadius}
						modifiers={[
							foregroundStyle(colors.secondarySystemGroupedBackground),
							shadow({ color: '#0000000F', radius: 8, y: 3 })
						]}
					/>
				</Background.Content>
			</Background>
			<Overlay.Content>
				<RoundedRectangle
					cornerRadius={cornerRadius}
					modifiers={[
						foregroundStyle('#00000000'),
						strokeBorder({
							content: {
								type: 'linearGradient',
								colors: [isDark ? '#FFFFFF12' : '#FFFFFF59', '#FFFFFF00'],
								startPoint: { x: 0.5, y: 0 },
								endPoint: { x: 0.5, y: 0.5 }
							},
							style: { lineWidth: 1 },
							shape: 'roundedRectangle',
							cornerRadius
						})
					]}
				/>
			</Overlay.Content>
		</Overlay>
	);
}

export function GlassCardBackground({
	cornerRadius = Radius.card,
	isHighlighted = false,
	children
}: {
	cornerRadius?: number;
	isHighlighted?: boolean;
	children: ReactNode;
}) {
	const isDark = useIsDark();
	const reduceTransparency = useReduceTransparency();
	const accent = useAccentColor();
	const rim = (color: string, lineWidth: number) => (
		<Overlay.Content>
			<RoundedRectangle
				cornerRadius={cornerRadius}
				modifiers={[
					foregroundStyle('#00000000'),
					strokeBorder({ color, style: { lineWidth }, shape: 'roundedRectangle', cornerRadius })
				]}
			/>
		</Overlay.Content>
	);

	if (isIOS26 && !reduceTransparency) {
		const wash = withOpacity(
			isDark
				? groupedHex.dark.secondarySystemGroupedBackground
				: groupedHex.light.secondarySystemGroupedBackground,
			0.78
		);
		return (
			<Overlay>
				<Background
					modifiers={[
						glassEffect({ glass: { variant: 'regular' }, shape: 'roundedRectangle', cornerRadius })
					]}
				>
					{children}
					<Background.Content>
						<RoundedRectangle cornerRadius={cornerRadius} modifiers={[foregroundStyle(wash)]} />
					</Background.Content>
				</Background>
				{isHighlighted
					? rim(withOpacity(accent, 0.45), 1.5)
					: rim(isDark ? '#FFFFFF14' : '#FFFFFF80', 1)}
			</Overlay>
		);
	}
	if (!isHighlighted)
		return (
			<DashboardCardBackground cornerRadius={cornerRadius}>{children}</DashboardCardBackground>
		);
	return (
		<Overlay>
			<DashboardCardBackground cornerRadius={cornerRadius}>{children}</DashboardCardBackground>
			{rim(withOpacity(accent, 0.45), 1.5)}
		</Overlay>
	);
}
