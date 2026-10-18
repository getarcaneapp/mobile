import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { PaginatedListFooter } from '@/ui/components/paginated-list';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { CenteredMessage } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';
import { useFederatedCredentials } from './use-federated-credentials';

export function FederatedCredentialsDestination() {
	const model = useFederatedCredentials();
	const { credentials } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			async () => {
				await model.reload();
			},
			() => setRefreshing(false)
		);
	};

	let content;
	if (model.unsupported) {
		content = (
			<CenteredMessage
				icon="key.slash"
				title="Federated Credentials Unavailable"
				message="This server does not support federated credential management."
			/>
		);
	} else if (model.loading && credentials.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	} else if (model.errorMessage !== undefined && credentials.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Credentials"
				message={model.errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.reload() }}
			/>
		);
	} else if (credentials.length === 0 && model.search.trim() !== '') {
		content = (
			<CenteredMessage
				icon="magnifyingglass"
				title={`No Results for “${model.search.trim()}”`}
				message="Check the spelling or try a new search."
			/>
		);
	} else if (credentials.length === 0) {
		content = (
			<CenteredMessage
				icon="key"
				title="No Federated Credentials"
				message="Create a credential to let workloads sign in with tokens from an external OIDC issuer."
				action={
					model.canManage ? { title: 'Create Credential', onPress: model.showCreate } : undefined
				}
			/>
		);
	} else {
		content = (
			<View style={{ paddingTop: 12 }}>
				<MaterialListGroup>
					{credentials.map((credential, index) => (
						<View key={credential.id} style={{ opacity: model.canRead ? 1 : 0.5 }}>
							{index > 0 ? (
								<View style={{ height: 0.5, marginLeft: 56, backgroundColor: colors.separator }} />
							) : null}
							<LongPressMenu
								title={credential.name}
								onPress={model.canRead ? () => model.openDetail(credential) : undefined}
								items={
									model.canManage
										? [
												{
													id: 'delete',
													title: 'Delete',
													destructive: true,
													onPress: () => model.requestDelete(credential)
												}
											]
										: []
								}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 16,
									paddingHorizontal: 16,
									paddingVertical: 12
								}}
							>
								<Icon name="key" size={22} color={colors.secondaryLabel} />
								<View style={{ flex: 1, gap: 2 }}>
									<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{credential.name}</Text>
									<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
										{credential.issuerUrl}
									</Text>
									<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
										{credential.enabled ? 'Enabled' : 'Disabled'}
									</Text>
								</View>
							</LongPressMenu>
						</View>
					))}
				</MaterialListGroup>
				<PaginatedListFooter
					key={credentials.length}
					hasMore={model.hasMore}
					loadMoreError={model.loadMoreError}
					onRetry={model.loadMore}
					onLoadMore={model.loadMore}
				/>
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Federated Credentials',
					headerSearchBarOptions: {
						onChangeText: (event) => model.setSearch(event.nativeEvent.text),
						onClose: () => model.setSearch('')
					}
				}}
			/>
			{model.canManage && !model.unsupported ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'create',
							icon: 'plus',
							label: 'Create Credential',
							onPress: model.showCreate
						}
					]}
				/>
			) : null}
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
