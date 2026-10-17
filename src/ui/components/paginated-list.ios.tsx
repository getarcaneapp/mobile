import { Button, ContentUnavailableView, Group, Link, Text } from '@expo/ui/swift-ui';
import { frame, onAppear } from '@expo/ui/swift-ui/modifiers';
import type { ReactElement } from 'react';

import { ArcaneLoadingViewSwiftUI } from './arcane-loading-view-swiftui';
import {
	isValidURL,
	type PaginatedListFooterProps,
	type ResourceListContainerProps
} from './paginated-list.types';

export { ListUX } from './paginated-list.types';

export function PaginatedListFooter({
	hasMore,
	loadMoreError,
	onRetry,
	onLoadMore
}: PaginatedListFooterProps) {
	if (!hasMore) return null;
	if (loadMoreError !== undefined) {
		return (
			<Button onPress={onRetry} modifiers={[frame({ maxWidth: Infinity })]}>
				<Text>Retry loading more</Text>
			</Button>
		);
	}
	return (
		<Group modifiers={[onAppear(onLoadMore)]}>
			<ArcaneLoadingViewSwiftUI label="Loading more…" variant="inline" fillsWidth />
		</Group>
	);
}

export function ResourceListContainer({
	isLoading,
	isEmpty,
	errorMessage,
	children
}: ResourceListContainerProps) {
	if (isLoading && isEmpty) {
		return (
			<Group modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</Group>
		);
	}
	if (errorMessage !== undefined && isEmpty) {
		return (
			<ContentUnavailableView
				title="Couldn't Load"
				systemImage="exclamationmark.triangle"
				description={errorMessage}
			/>
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
	return <Link destination={urlString}>{children}</Link>;
}
