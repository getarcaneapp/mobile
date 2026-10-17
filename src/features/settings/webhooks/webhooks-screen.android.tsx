import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import type { Webhook } from '@/sdk/models/webhook/Webhook';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { CenteredMessage } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { LongPressMenu } from '../shared/long-press-menu';
import { capitalized, relativeStyle, useWebhooks, webhookIcon } from './use-webhooks';

function Chip({ icon, text }: { icon: string; text: string }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
			<Icon name={icon} size={14} color={colors.secondaryLabel} />
			<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{text}</Text>
		</View>
	);
}

function WebhookRow({ webhook }: { webhook: Webhook }) {
	const triggered = webhook.lastTriggeredAt ? relativeStyle(webhook.lastTriggeredAt) : undefined;
	return (
		<View style={{ gap: 4, flex: 1 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Text style={[m3Type.titleMedium, { color: colors.label, flex: 1 }]}>{webhook.name}</Text>
				<View
					style={{
						paddingHorizontal: 8,
						paddingVertical: 2,
						borderRadius: 8,
						backgroundColor: webhook.enabled
							? withOpacity(systemColors.green, 0.15)
							: m3.surfaceContainerHighest
					}}
				>
					<Text
						style={[
							m3Type.labelMedium,
							{ color: webhook.enabled ? systemColors.green : colors.secondaryLabel }
						]}
					>
						{webhook.enabled ? 'Enabled' : 'Disabled'}
					</Text>
				</View>
			</View>
			<View style={{ flexDirection: 'row', gap: 8 }}>
				<Chip icon={webhookIcon(webhook.targetType)} text={capitalized(webhook.targetType)} />
				<Chip icon="arrow.right.circle" text={capitalized(webhook.actionType)} />
			</View>
			{webhook.targetName ? (
				<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}>
					{webhook.targetName}
				</Text>
			) : null}
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Text
					style={[
						m3Type.labelSmall,
						{ color: colors.tertiaryLabel, fontFamily: monoFamily, flex: 1 }
					]}
				>{`${webhook.tokenPrefix}…`}</Text>
				{triggered ? (
					<Text
						style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}
					>{`Last: ${triggered} ago`}</Text>
				) : null}
			</View>
		</View>
	);
}

export function WebhooksDestination() {
	const model = useWebhooks();
	const { webhooks } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.loadWebhooks();
		} finally {
			setRefreshing(false);
		}
	};

	let content;
	if (model.isLoading && webhooks.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading webhooks…" />
			</View>
		);
	} else if (webhooks.length === 0) {
		content = (
			<CenteredMessage
				icon="link.badge.plus"
				title="No Webhooks"
				message="Create a webhook to trigger actions via HTTP."
				action={{ title: 'Create Webhook', onPress: model.showCreateSheet }}
			/>
		);
	} else {
		content = (
			<View>
				<View style={{ paddingHorizontal: 16 }}>
					<ResourceCountSectionHeader title="Webhooks" loadedCount={webhooks.length} />
				</View>
				<MaterialListGroup>
					{webhooks.map((webhook, index) => (
						<View key={webhook.id}>
							{index > 0 ? (
								<View
									style={{ height: 0.5, marginHorizontal: 16, backgroundColor: colors.separator }}
								/>
							) : null}
							<LongPressMenu
								title={webhook.name}
								items={[
									{
										id: 'toggle',
										title: webhook.enabled ? 'Disable' : 'Enable',
										onPress: () => model.toggleWebhook(webhook)
									},
									{
										id: 'delete',
										title: 'Delete',
										destructive: true,
										onPress: () => model.requestDelete(webhook)
									}
								]}
								style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 }}
							>
								<WebhookRow webhook={webhook} />
							</LongPressMenu>
						</View>
					))}
				</MaterialListGroup>
			</View>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Webhooks' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'add',
						icon: 'plus',
						label: 'Add Webhook',
						onPress: model.showCreateSheet
					}
				]}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
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
