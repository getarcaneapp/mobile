import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { MaterialListItem } from '@/ui/material/list';
import { Icon } from '@/ui/Icon';

import { ActionErrorAlert } from '../shared/action-error-alert';
import { M3Section } from '../shared/android-material';
import { LongPressMenu } from '../shared/long-press-menu';
import {
	providerDisplayName,
	providerIconColor,
	providerSystemImage
} from './notification-provider-models';
import { useNotificationSettings } from './use-notification-settings';

export function NotificationsDestination() {
	const model = useNotificationSettings();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const refresh = async () => {
		setIsRefreshing(true);
		await model.loadProviders();
		setIsRefreshing(false);
	};

	return (
		<>
			<Stack.Screen options={{ title: 'Notifications' }} />
			<ActionErrorAlert title="Error" message={model.errorMessage} onDismiss={model.dismissError} />
			{model.isLoading && !model.hasConfiguredProviders ? (
				<View
					style={{
						flex: 1,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: colors.systemGroupedBackground
					}}
				>
					<ArcaneLoadingView label="Loading notifications…" />
				</View>
			) : (
				<ScrollView
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingBottom: 32 }}
					refreshControl={
						<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} />
					}
				>
					<M3Section
						title="Notification Providers"
						footer="Configure providers to receive notifications for container events."
					>
						{model.availableProviders.map((provider) => {
							const existing = model.configuredResponse(provider);
							const supporting = existing
								? existing.enabled
									? 'Enabled'
									: 'Disabled'
								: 'Not Configured';
							return (
								<LongPressMenu
									key={provider}
									title={providerDisplayName[provider]}
									accessibilityLabel={`${providerDisplayName[provider]}, ${supporting}`}
									onPress={() => model.openProvider(provider)}
									items={
										existing
											? [
													{
														id: 'delete',
														title: 'Delete',
														destructive: true,
														onPress: () => model.requestDelete(provider)
													}
												]
											: []
									}
								>
									<View pointerEvents="none">
										<MaterialListItem
											headline={providerDisplayName[provider]}
											supporting={supporting}
											leading={
												<Icon
													name={providerSystemImage[provider]}
													size={24}
													color={providerIconColor[provider]}
												/>
											}
											trailing={
												<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
											}
										/>
									</View>
								</LongPressMenu>
							);
						})}
					</M3Section>
				</ScrollView>
			)}
		</>
	);
}
