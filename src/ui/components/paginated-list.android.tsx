/**
 * Android ports of `PaginatedListFooter`, `ResourceListContainer`, `ListUX`
 * and `SafeExternalLink`.
 *
 * Standalone (RN views).
 */
import { useEffect, type ReactElement } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import { ArcaneLoadingView } from './arcane-loading-view';
import { m3 } from './material-colors';
import {
	isValidURL,
	type PaginatedListFooterProps,
	type ResourceListContainerProps
} from './paginated-list.types';
import { m3Type } from './type-scale';

export { ListUX } from './paginated-list.types';

function LoadMoreSpinner({ onLoadMore }: { onLoadMore: () => void }) {
	// Same contract as SwiftUI `onAppear`: the footer appearing loads the next page.
	useEffect(() => {
		onLoadMore();
	}, [onLoadMore]);
	return (
		<View style={{ alignItems: 'center', paddingVertical: 16 }}>
			<ArcaneLoadingView label="Loading more…" variant="inline" />
		</View>
	);
}

export function PaginatedListFooter({
	hasMore,
	loadMoreError,
	onRetry,
	onLoadMore
}: PaginatedListFooterProps) {
	if (!hasMore) return null;
	if (loadMoreError !== undefined) {
		return (
			<Pressable
				onPress={onRetry}
				accessibilityRole="button"
				android_ripple={{ color: colors.separator as string }}
				style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
			>
				<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Retry loading more</Text>
			</Pressable>
		);
	}
	return <LoadMoreSpinner onLoadMore={onLoadMore} />;
}

export function ResourceListContainer({
	isLoading,
	isEmpty,
	errorMessage,
	children
}: ResourceListContainerProps) {
	if (isLoading && isEmpty) {
		return (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	}
	if (errorMessage !== undefined && isEmpty) {
		return (
			<View
				style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}
			>
				<Icon name="exclamationmark.triangle" size={40} color={colors.secondaryLabel} />
				<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>
					Couldn't Load
				</Text>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{errorMessage}
				</Text>
			</View>
		);
	}
	return <>{children}</>;
}

export function SafeExternalLink({
	urlString,
	children
}: {
	urlString: string;
	children: ReactElement;
}) {
	if (!isValidURL(urlString)) return null;
	return (
		<Pressable
			accessibilityRole="link"
			onPress={() => void Linking.openURL(urlString)}
			android_ripple={{ color: colors.separator as string }}
		>
			{children}
		</Pressable>
	);
}
