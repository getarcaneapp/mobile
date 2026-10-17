import { createContext } from 'react';

/**
 * Set by `SkeletonShimmer` for descendant skeleton fills. False means no active
 * shimmer, so placeholders render static (no ancestor, or Reduce Motion on).
 */
export const SkeletonShimmerContext = createContext(false);

/** Seconds for one full left-to-right sweep. */
export const shimmerPeriod = 1.6;

export type SkeletonRectProps = {
	width?: number;
	height: number;
	cornerRadius?: number;
	fillOpacity?: number;
};
export type SkeletonCircleProps = { size: number; fillOpacity?: number };

/** `Color.secondary.opacity(x)`: UIKit secondaryLabel already carries 60% alpha. */
export const skeletonBase = { light: '#3C3C43', dark: '#EBEBF5' } as const;
export const skeletonAlpha = (fillOpacity: number) => 0.6 * fillOpacity;

/** A gentle lift over the base fill: faint in dark mode, a soft wash in light. */
export const sweepColor = (isDark: boolean) => (isDark ? '#FFFFFF1A' : '#FFFFFF66');
