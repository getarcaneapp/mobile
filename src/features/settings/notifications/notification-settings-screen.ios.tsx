/** Port of `NotificationSettingsView` (NotificationSettingsView.swift). */
import {
	Button,
	HStack,
	Label,
	List,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Host } from '@/ui/host';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	listStyle,
	refreshable,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NotificationProvider } from '@/sdk/models/notification/Notification';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { DisclosureChevron } from '@/ui/settings-row';

import { ActionErrorAlert } from '../shared/action-error-alert';
import {
	providerDisplayName,
	providerIconColor,
	providerSystemImage
} from './notification-provider-models';
import { useNotificationSettings } from './use-notification-settings';

type Model = ReturnType<typeof useNotificationSettings>;

function ProviderRow({ provider, model }: { provider: NotificationProvider; model: Model }) {
	const existing = model.configuredResponse(provider);
	const row = (
		<Button onPress={() => model.openProvider(provider)} modifiers={[buttonStyle('plain')]}>
			<HStack spacing={12} modifiers={[contentShape(shapes.rectangle())]}>
				<Image
					systemName={providerSystemImage[provider] as SFSymbol}
					modifiers={[foregroundStyle(providerIconColor[provider]), frame({ width: 28 })]}
				/>
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[foregroundStyle('primary')]}>{providerDisplayName[provider]}</Text>
					{existing ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle(existing.enabled ? systemColors.green : 'secondary')
							]}
						>
							{existing.enabled ? 'Enabled' : 'Disabled'}
						</Text>
					) : (
						<Text
							modifiers={[
								font({ textStyle: 'caption' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							Not Configured
						</Text>
					)}
				</VStack>
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
	if (!existing) return row;
	return (
		<SwipeActions>
			{row}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				<Button onPress={() => model.requestDelete(provider)} modifiers={[tint(systemColors.red)]}>
					<Label title="Delete" systemImage="trash" />
				</Button>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

/** `appTabDestination(.notifications)`. */
export function NotificationsDestination() {
	const model = useNotificationSettings();
	return (
		<>
			<Stack.Screen options={{ title: 'Notifications' }} />
			{model.isLoading && !model.hasConfiguredProviders ? (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
					<ArcaneLoadingView label="Loading notifications…" />
				</View>
			) : (
				<Host style={{ flex: 1 }}>
					<List modifiers={[listStyle('insetGrouped'), refreshable(model.loadProviders)]}>
						<Section
							title="Notification Providers"
							footer={
								<Text>Configure providers to receive notifications for container events.</Text>
							}
						>
							{model.availableProviders.map((provider) => (
								<ProviderRow key={provider} provider={provider} model={model} />
							))}
						</Section>
					</List>
					{/* Outside the List: inside it, the alert's anchor renders as an empty row. */}
					<ActionErrorAlert
						title="Error"
						message={model.errorMessage}
						onDismiss={model.dismissError}
					/>
				</Host>
			)}
		</>
	);
}
