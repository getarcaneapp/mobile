/**
 * Shared props and copy for the small label components: `ResourceCountLabel`,
 * `SectionHeader`, `UpdateStateBadge`, `DestructiveLabel`.
 */
import type { ReactNode } from 'react';

import { systemColors } from '@/theme/colors';

export type ResourceCountProps = {
	loadedCount: number;
	totalCount?: number;
	hasMore?: boolean;
};

const items = (count: number) => (count === 1 ? 'item' : 'items');

/** Visible text and VoiceOver text for `ResourceCountLabel`. */
export function resourceCountText({
	loadedCount,
	totalCount,
	hasMore = false
}: ResourceCountProps) {
	const knownTotal = totalCount !== undefined && totalCount >= 0 ? totalCount : undefined;
	if (hasMore && knownTotal !== undefined && knownTotal > loadedCount) {
		return {
			text: `${loadedCount} of ${knownTotal}`,
			accessibility: `Showing ${loadedCount} of ${knownTotal} items`
		};
	}
	if (hasMore) {
		return {
			text: `${loadedCount} loaded`,
			accessibility: `${loadedCount} ${items(loadedCount)} loaded`
		};
	}
	const text = `${loadedCount} ${items(loadedCount)}`;
	return { text, accessibility: text };
}

export type SectionHeaderProps = {
	title: string;
	systemImage?: string;
	count?: number;
	trailing?: ReactNode;
};

/** Port of `ImageUpdateState`. */
export type ImageUpdateState =
	| { kind: 'unknown' }
	| { kind: 'upToDate' }
	| { kind: 'hasUpdate' }
	| { kind: 'error'; message: string };

export function updateStatePresentation(state: ImageUpdateState) {
	switch (state.kind) {
		case 'unknown':
			return {
				title: 'Not checked',
				symbol: 'questionmark.circle',
				color: undefined,
				accessibility: 'Update status not checked'
			};
		case 'upToDate':
			return {
				title: 'Up to date',
				symbol: 'checkmark.circle.fill',
				color: systemColors.green,
				accessibility: 'Up to date'
			};
		case 'hasUpdate':
			return {
				title: 'Update available',
				symbol: 'arrow.up.circle.fill',
				color: systemColors.orange,
				accessibility: 'Update available'
			};
		case 'error':
			return {
				title: 'Check failed',
				symbol: 'exclamationmark.triangle.fill',
				color: systemColors.red,
				accessibility: `Update check failed: ${state.message}`
			};
	}
}

export type DestructiveLabelProps = { text: string; systemImage?: string };
