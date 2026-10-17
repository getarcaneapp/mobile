/** Port of `WebhooksView` + `WebhookRow` (WebhooksView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	HStack,
	Label,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	background,
	contentShape,
	font,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	refreshable,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { Webhook } from '@/sdk/models/webhook/Webhook';
import { systemColors, withOpacity } from '@/theme/colors';
import { secondaryHex, useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { RowPreviewCard } from '@/ui/components/row-preview-card';

const accentColorAsset = '#AF52DE';
import { AppToolbar } from '@/ui/components/toolbar';

import { ContentUnavailableWithActions } from '../shared/content-unavailable-actions';
import {
	capitalized,
	relativeStyle,
	useWebhooks,
	webhookIcon,
	type WebhooksModel
} from './use-webhooks';

const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;

function WebhookRow({ webhook }: { webhook: Webhook }) {
	const isDark = useIsDark();
	const secondary = secondaryHex[isDark ? 'dark' : 'light'];
	const triggered = webhook.lastTriggeredAt ? relativeStyle(webhook.lastTriggeredAt) : undefined;
	return (
		<VStack
			alignment="leading"
			spacing={4}
			modifiers={[padding({ vertical: 2 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<HStack>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{webhook.name}</Text>
				<Spacer />
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						padding({ horizontal: 8, vertical: 2 }),
						background(
							withOpacity(
								webhook.enabled ? systemColors.green : secondary,
								webhook.enabled ? 0.15 : 0.09
							),
							shapes.capsule()
						),
						foregroundStyle(webhook.enabled ? systemColors.green : 'secondary')
					]}
				>
					{webhook.enabled ? 'Enabled' : 'Disabled'}
				</Text>
			</HStack>
			<HStack spacing={8}>
				<Label
					title={capitalized(webhook.targetType)}
					systemImage={webhookIcon(webhook.targetType) as SFSymbol}
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				/>
				<Label
					title={capitalized(webhook.actionType)}
					systemImage="arrow.right.circle"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				/>
			</HStack>
			{webhook.targetName ? (
				<Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(tertiary)]}>
					{webhook.targetName}
				</Text>
			) : null}
			<HStack>
				<Text
					modifiers={[
						font({ textStyle: 'caption2', design: 'monospaced' }),
						foregroundStyle(tertiary)
					]}
				>{`${webhook.tokenPrefix}…`}</Text>
				<Spacer />
				{triggered ? (
					<Text
						modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(tertiary)]}
					>{`Last: ${triggered} ago`}</Text>
				) : null}
			</HStack>
		</VStack>
	);
}

function WebhookPreview({ webhook }: { webhook: Webhook }) {
	const isDark = useIsDark();
	return (
		<RowPreviewCard
			icon={webhookIcon(webhook.targetType)}
			// Swift passes `.accentColor`; the context-menu preview is hosted outside the app's
			// `.accentColor(_:)` environment, so it resolves to the AccentColor asset (purple).
			iconColor={accentColorAsset}
			title={webhook.name}
			badges={[
				{
					text: webhook.enabled ? 'Enabled' : 'Disabled',
					color: webhook.enabled ? systemColors.green : secondaryHex[isDark ? 'dark' : 'light']
				},
				{ text: capitalized(webhook.targetType), color: accentColorAsset }
			]}
			details={[
				...(webhook.targetName
					? [{ icon: 'scope', label: 'Target', value: webhook.targetName }]
					: []),
				{ icon: 'arrow.right.circle', label: 'Action', value: capitalized(webhook.actionType) },
				{ icon: 'key', label: 'Token', value: `${webhook.tokenPrefix}…` }
			]}
		/>
	);
}

function WebhookItem({ model, webhook }: { model: WebhooksModel; webhook: Webhook }) {
	return (
		<ContextMenu>
			<ContextMenu.Trigger>
				<HStack modifiers={[contentShape(shapes.rectangle())]}>
					<WebhookRow webhook={webhook} />
				</HStack>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				<Button
					label={webhook.enabled ? 'Disable' : 'Enable'}
					systemImage={webhook.enabled ? 'pause.circle' : 'play.circle'}
					onPress={() => model.toggleWebhook(webhook)}
				/>
				<Button
					role="destructive"
					onPress={() => model.requestDelete(webhook)}
					modifiers={[tint(systemColors.red)]}
				>
					<DestructiveLabel text="Delete" />
				</Button>
			</ContextMenu.Items>
			<ContextMenu.Preview>
				<WebhookPreview webhook={webhook} />
			</ContextMenu.Preview>
		</ContextMenu>
	);
}

export function WebhooksDestination() {
	const model = useWebhooks();
	const { webhooks } = model;

	let content;
	if (model.isLoading && webhooks.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading webhooks…" />
			</VStack>
		);
	} else if (webhooks.length === 0) {
		content = (
			<ContentUnavailableWithActions
				title="No Webhooks"
				systemImage="link.badge.plus"
				description="Create a webhook to trigger actions via HTTP."
				actions={[{ title: 'Create Webhook', onPress: model.showCreateSheet }]}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.loadWebhooks)]}>
				<Section
					header={<ResourceCountSectionHeader title="Webhooks" loadedCount={webhooks.length} />}
				>
					{webhooks.map((webhook) => (
						<WebhookItem key={webhook.id} model={model} webhook={webhook} />
					))}
				</Section>
			</List>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Webhooks' }} />
			<AppToolbar>
				<Stack.Toolbar.Button
					icon="plus"
					accessibilityLabel="Add Webhook"
					onPress={model.showCreateSheet}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
