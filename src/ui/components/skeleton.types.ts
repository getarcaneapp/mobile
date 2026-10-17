import { createContext } from 'react';

export const SkeletonShimmerContext = createContext(false);

export const shimmerPeriod = 1.6;

export type SkeletonRectProps = {
	width?: number;
	height: number;
	cornerRadius?: number;
	fillOpacity?: number;
};
export type SkeletonCircleProps = { size: number; fillOpacity?: number };

export const skeletonBase = { light: '#3C3C43', dark: '#EBEBF5' } as const;
export const skeletonAlpha = (fillOpacity: number) => 0.6 * fillOpacity;

export const sweepColor = (isDark: boolean) => (isDark ? '#FFFFFF1A' : '#FFFFFF66');
