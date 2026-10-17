/** Port of `FederatedCredentialsView` (FederatedCredentialsView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	HStack,
	Label,
	List,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	refreshable,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { FederatedCredential } from '@/sdk/models/federated/FederatedCredential';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { ContentUnavailableWithActions } from '../shared/content-unavailable-actions';
import {
	useFederatedCredentials,
	type FederatedCredentialsModel
} from './use-federated-credentials';

function CredentialRow({
	model,
	credential
}: {
	model: FederatedCredentialsModel;
	credential: FederatedCredential;
}) {
	const link = (
		<Button
			onPress={() => model.openDetail(credential)}
			modifiers={[buttonStyle('plain'), disabled(!model.canRead)]}
		>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<Label systemImage="key" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
					<VStack alignment="leading">
						<Text>{credential.name}</Text>
						<Text
							modifiers={[
								font({ textStyle: 'subheadline' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{credential.issuerUrl}
						</Text>
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{credential.enabled ? 'Enabled' : 'Disabled'}
						</Text>
					</VStack>
				</Label>
				<DisclosureChevron />
			</HStack>
		</Button>
	);
	if (!model.canManage) return link;
	return (
		<SwipeActions>
			{link}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button
					role="destructive"
					label="Delete"
					systemImage="trash"
					onPress={() => model.requestDelete(credential)}
				/>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function FederatedCredentialsDestination() {
	const model = useFederatedCredentials();
	const { credentials } = model;

	let content;
	if (model.unsupported) {
		content = (
			<ContentUnavailableView
				title="Federated Credentials Unavailable"
				systemImage="key.slash"
				description="This server does not support federated credential management."
			/>
		);
	} else if (model.loading && credentials.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && credentials.length === 0) {
		content = (
			<ContentUnavailableWithActions
				title="Couldn't Load Credentials"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.reload() }]}
			/>
		);
	} else if (credentials.length === 0) {
		content = (
			<ContentUnavailableWithActions
				title="No Federated Credentials"
				systemImage="key"
				description="Create a credential or try a different search."
				actions={model.canManage ? [{ title: 'Create Credential', onPress: model.showCreate }] : []}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.reload)]}>
				{credentials.map((credential) => (
					<CredentialRow key={credential.id} model={model} credential={credential} />
				))}
				<PaginatedListFooter
					key={credentials.length}
					hasMore={model.hasMore}
					loadMoreError={model.loadMoreError}
					onRetry={model.loadMore}
					onLoadMore={model.loadMore}
				/>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Federated Credentials',
					headerSearchBarOptions: {
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearch('')
					}
				}}
			/>
			{model.canManage && !model.unsupported ? (
				<AppToolbar>
					<Stack.Toolbar.Button
						icon="plus"
						accessibilityLabel="Create Credential"
						onPress={model.showCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
