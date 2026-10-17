import { Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, Text } from 'react-native';

import { LiveStatsLimit } from '@/stores/dashboard-stream-logic';
import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListItem } from '@/ui/material/list';

import { M3Section } from '../shared/android-material';
import { useSettingsNavigation } from '../shared/settings-routes';
import { ActivityToastScope } from './activity-toast-scope';
import { AppSettingsRoutes } from './app-settings-routes';
import { IconSwitchRow, MenuValueRow } from './android-rows';
import { supportLinks, useAppSettings } from './use-app-settings';

const liveStatsOptions = LiveStatsLimit.choices.map((choice) => ({
	value: choice as number,
	title: LiveStatsLimit.title(choice)
}));
const toastScopeOptions = ActivityToastScope.allCases.map((scope) => ({
	value: scope,
	title: ActivityToastScope.title(scope)
}));

export function AppSettingsScreen() {
	const model = useAppSettings();
	const navigation = useSettingsNavigation();
	return (
		<>
			<Stack.Screen options={{ title: 'App Settings' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section title="General">
					<MaterialListItem
						headline="Appearance"
						icon="paintbrush.fill"
						iconColor={systemColors.pink}
						onPress={() => navigation.push(AppSettingsRoutes.appearance)}
					/>
					<IconSwitchRow
						title="Remember Last Tab"
						icon="arrow.uturn.backward.square"
						iconColor={systemColors.indigo}
						value={model.rememberLastTab}
						onValueChange={model.setRememberLastTab}
					/>
				</M3Section>

				<M3Section
					title="Dashboard"
					footer="How many environments stream live CPU, memory, and disk on the dashboard. Each keeps a connection open, using more data and battery."
				>
					<MenuValueRow
						title="Live Stats Environments"
						icon="waveform.path.ecg"
						iconColor={systemColors.green}
						options={liveStatsOptions}
						selection={model.liveStatsLimit}
						onSelect={model.setLiveStatsLimit}
					/>
				</M3Section>

				<M3Section title="Notifications" footer={model.notificationsFooter}>
					<MenuValueRow
						title="Activity Toasts"
						icon="bell.badge.fill"
						iconColor={systemColors.orange}
						options={toastScopeOptions}
						selection={model.activityToastScope}
						onSelect={model.setActivityToastScope}
					/>
					{model.showsPushToggle ? (
						<IconSwitchRow
							title="Push Notifications"
							icon="iphone.radiowaves.left.and.right"
							iconColor={systemColors.blue}
							value={model.pushEnabled}
							onValueChange={model.setPushEnabled}
							disabled={model.pushToggleDisabled}
						/>
					) : null}
				</M3Section>

				<M3Section title="Support">
					{supportLinks.map((link) => (
						<MaterialListItem
							key={link.url}
							headline={link.title}
							icon={link.systemImage}
							iconColor={systemColors[link.color]}
							trailing={<Icon name="arrow.up.right" size={18} color={colors.tertiaryLabel} />}
							onPress={() => void Linking.openURL(link.url)}
						/>
					))}
				</M3Section>

				<M3Section title="Storage" footer="Cached images are re-fetched as needed.">
					<MaterialListItem
						headline="Clear Cache"
						icon="trash"
						iconColor={m3.error}
						destructive
						trailingText={model.cacheSizeText}
						onPress={model.clearCache}
					/>
				</M3Section>

				<Pressable
					onPress={model.copyVersion}
					accessibilityRole="button"
					accessibilityLabel={`Copy version ${model.appVersionString}, build ${model.appBuildString}`}
					style={{ alignItems: 'center', gap: 2, paddingTop: 32, paddingBottom: 8 }}
				>
					<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel, fontWeight: '500' }]}>
						Arcane Mobile
					</Text>
					<Text
						style={[
							m3Type.labelSmall,
							{ color: colors.tertiaryLabel, fontVariant: ['tabular-nums'] }
						]}
					>
						{`Version ${model.appVersionString} (${model.appBuildString})`}
					</Text>
				</Pressable>
			</ScrollView>
		</>
	);
}
