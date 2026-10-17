/** Port of `AppSettingsView` (AppSettingsView.swift). */
import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Link,
	List,
	Picker,
	Section,
	Spacer,
	Text,
	Toggle,
	VStack
} from '@expo/ui/swift-ui';
import {
	accessibilityLabel,
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	monospacedDigit,
	padding,
	pickerStyle,
	shapes,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { LiveStatsLimit } from '@/stores/dashboard-stream-logic';
import { systemColors } from '@/theme/colors';
import { DisclosureChevron, SettingsRow } from '@/ui/settings-row';

import { SettingsExternalRow } from '../shared/settings-external-row';
import { useSettingsNavigation } from '../shared/settings-routes';
import { ActivityToastScope } from './activity-toast-scope';
import { AppSettingsRoutes } from './app-settings-routes';
import { supportLinks, useAppSettings, type AppSettingsModel } from './use-app-settings';

export function AppSettingsScreen() {
	const model = useAppSettings();
	return (
		<>
			<Stack.Screen options={{ title: 'App Settings', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<GeneralSection model={model} />
					<DashboardSection model={model} />
					<NotificationsSection model={model} />
					<SupportSection />
					<StorageSection model={model} />
				</List>
			</Host>
		</>
	);
}

function GeneralSection({ model }: { model: AppSettingsModel }) {
	const navigation = useSettingsNavigation();
	return (
		<Section title="General">
			<Button onPress={() => navigation.push(AppSettingsRoutes.appearance)}>
				<HStack>
					<SettingsRow title="Appearance" systemImage="paintbrush.fill" color={systemColors.pink} />
					<Spacer />
					<DisclosureChevron />
				</HStack>
			</Button>
			<Toggle isOn={model.rememberLastTab} onIsOnChange={model.setRememberLastTab}>
				<SettingsRow
					title="Remember Last Tab"
					systemImage="arrow.uturn.backward.square"
					color={systemColors.indigo}
				/>
			</Toggle>
		</Section>
	);
}

function DashboardSection({ model }: { model: AppSettingsModel }) {
	return (
		<Section
			header={<Text>Dashboard</Text>}
			footer={
				<Text>
					How many environments stream live CPU, memory, and disk on the dashboard. Each keeps a
					connection open, using more data and battery.
				</Text>
			}
		>
			<Picker<number>
				label={
					<SettingsRow
						title="Live Stats Environments"
						systemImage="waveform.path.ecg"
						color={systemColors.green}
					/>
				}
				selection={model.liveStatsLimit}
				onSelectionChange={model.setLiveStatsLimit}
				modifiers={[pickerStyle('menu')]}
			>
				{LiveStatsLimit.choices.map((choice) => (
					<Text key={choice} modifiers={[tag(choice)]}>
						{LiveStatsLimit.title(choice)}
					</Text>
				))}
			</Picker>
		</Section>
	);
}

function NotificationsSection({ model }: { model: AppSettingsModel }) {
	return (
		<Section header={<Text>Notifications</Text>} footer={<Text>{model.notificationsFooter}</Text>}>
			<Picker<string>
				label={
					<SettingsRow
						title="Activity Toasts"
						systemImage="bell.badge.fill"
						color={systemColors.orange}
					/>
				}
				selection={model.activityToastScope}
				onSelectionChange={(value) => model.setActivityToastScope(ActivityToastScope.from(value))}
				modifiers={[pickerStyle('menu')]}
			>
				{ActivityToastScope.allCases.map((scope) => (
					<Text key={scope} modifiers={[tag(scope)]}>
						{ActivityToastScope.title(scope)}
					</Text>
				))}
			</Picker>
			{model.showsPushToggle ? (
				<Toggle
					isOn={model.pushEnabled}
					onIsOnChange={model.setPushEnabled}
					modifiers={[disabled(model.pushToggleDisabled)]}
				>
					<SettingsRow
						title="Push Notifications"
						systemImage="iphone.radiowaves.left.and.right"
						color={systemColors.blue}
					/>
				</Toggle>
			) : null}
		</Section>
	);
}

function SupportSection() {
	return (
		<Section title="Support">
			{supportLinks.map((link) => (
				<Link key={link.url} destination={link.url}>
					<SettingsExternalRow
						title={link.title}
						systemImage={link.systemImage}
						color={systemColors[link.color]}
					/>
				</Link>
			))}
		</Section>
	);
}

function StorageSection({ model }: { model: AppSettingsModel }) {
	return (
		<Section
			header={<Text>Storage</Text>}
			footer={
				<VStack alignment="leading" spacing={20}>
					<Text>Cached images are re-fetched as needed.</Text>
					<VersionFooter model={model} />
				</VStack>
			}
		>
			<Button role="destructive" onPress={model.clearCache}>
				<HStack>
					<SettingsRow
						title="Clear Cache"
						systemImage="trash"
						color={systemColors.red}
						titleColor={systemColors.red}
					/>
					<Spacer />
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{model.cacheSizeText}
					</Text>
				</HStack>
			</Button>
		</Section>
	);
}

/** Tapping the bottom footer copies the complete version string. */
function VersionFooter({ model }: { model: AppSettingsModel }) {
	const { appVersionString, appBuildString } = model;
	return (
		<Button
			onPress={model.copyVersion}
			modifiers={[
				buttonStyle('plain'),
				accessibilityLabel(`Copy version ${appVersionString}, build ${appBuildString}`)
			]}
		>
			<VStack
				spacing={2}
				modifiers={[
					font({ textStyle: 'caption2' }),
					foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
					frame({ maxWidth: Infinity }),
					padding({ top: 12 }),
					contentShape(shapes.rectangle())
				]}
			>
				<Text modifiers={[font({ textStyle: 'caption2', weight: 'medium' })]}>Arcane Mobile</Text>
				<Text
					modifiers={[monospacedDigit()]}
				>{`Version ${appVersionString} (${appBuildString})`}</Text>
			</VStack>
		</Button>
	);
}
