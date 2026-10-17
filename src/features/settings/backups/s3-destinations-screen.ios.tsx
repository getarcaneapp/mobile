/** Port of `S3DestinationsView` (S3DestinationsView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	ConfirmationDialog,
	ContentUnavailableView,
	List,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, listStyle, refreshable } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';

import { useAccentColor } from '@/theme/accent';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';

import { AccentLabel, ErrorRetryRows, NavigationRow } from './backup-rows';
import { useS3Destinations } from './use-s3-destinations';

export function S3DestinationsScreen() {
	const model = useS3Destinations();
	const accent = useAccentColor();
	const { destinations, busy, errorMessage, deleteTarget } = model;

	return (
		<>
			<Stack.Screen options={{ title: 'S3 Destinations' }} />
			{model.canCreate ? (
				<AppToolbar placement="right" tintColor={accent}>
					<Stack.Toolbar.Button
						icon="plus"
						accessibilityLabel="Add S3 Destination"
						onPress={model.openCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<ConfirmationDialog
					title="Delete S3 destination?"
					titleVisibility="visible"
					isPresented={deleteTarget !== undefined}
					onIsPresentedChange={(isPresented) => {
						if (!isPresented) model.setDeleteTarget(undefined);
					}}
				>
					<ConfirmationDialog.Trigger>
						<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
							{busy && destinations.length === 0 ? (
								<ArcaneLoadingViewSwiftUI label="Loading…" fillsWidth />
							) : null}
							<ErrorRetryRows message={errorMessage} onRetry={() => void model.load()} />
							{destinations.map((destination) => (
								<SwipeActions key={destination.id}>
									<NavigationRow onPress={() => model.openEditor(destination)}>
										<AccentLabel systemImage="externaldrive.connected.to.line.below">
											<VStack alignment="leading">
												<Text>{destination.name}</Text>
												<Text
													modifiers={[
														font({ textStyle: 'subheadline' }),
														foregroundStyle({ type: 'hierarchical', style: 'secondary' })
													]}
												>
													{destination.bucket}
												</Text>
												<Text
													modifiers={[
														font({ textStyle: 'caption' }),
														foregroundStyle({ type: 'hierarchical', style: 'secondary' })
													]}
												>
													{destination.region}
												</Text>
											</VStack>
										</AccentLabel>
									</NavigationRow>
									<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
										{model.canDelete ? (
											<Button
												role="destructive"
												label="Delete"
												systemImage="trash"
												onPress={() => model.setDeleteTarget(destination)}
											/>
										) : null}
									</SwipeActions.Actions>
								</SwipeActions>
							))}
							{destinations.length === 0 && !busy && errorMessage === undefined ? (
								<ContentUnavailableView
									title="No S3 Destinations"
									systemImage="externaldrive.connected.to.line.below"
								/>
							) : null}
							<PaginatedListFooter
								key={destinations.length}
								hasMore={model.hasMore}
								loadMoreError={model.loadMoreError}
								onRetry={model.loadMore}
								onLoadMore={model.loadMore}
							/>
						</List>
					</ConfirmationDialog.Trigger>
					<ConfirmationDialog.Actions>
						<Button
							label="Delete"
							role="destructive"
							onPress={() => {
								if (deleteTarget) model.remove(deleteTarget);
							}}
						/>
					</ConfirmationDialog.Actions>
					<ConfirmationDialog.Message>
						<Text>Destinations referenced by backups or policies cannot be deleted.</Text>
					</ConfirmationDialog.Message>
				</ConfirmationDialog>
			</Host>
		</>
	);
}
