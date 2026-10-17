/** Android (Material 3) rendering of `EnvironmentDetailView` (EnvironmentDetailView.swift). */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ErrorBanner } from '@/ui/components/error-banner';
import { m3 } from '@/ui/components/material-colors';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import {
	SaveBarClearanceSection,
	SettingsErrorSection,
	SettingsSectionsView
} from '@/ui/components/settings-form';
import { SettingsSaveBar } from '@/features/settings/shared/settings-save-bar';
import {
	environmentAutomationSections,
	environmentDockerSections,
	environmentFeatureSections,
	environmentSecuritySectionCases,
	environmentSecuritySections,
	environmentStorageSections,
	type EnvironmentSecuritySection,
	type SettingsSectionDef
} from '@/ui/components/settings-form.types';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { EnvironmentConnectionView } from './environment-connection-view';
import {
	dockerInfoGroups,
	headerStatus,
	systemInfoGroups,
	type InfoGroup
} from './environment-detail-model';
import { useEnvironmentDetail, type EnvironmentDetailModel } from './use-environment-detail';

function FlatRow({ children }: { children: ReactNode }) {
	return <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>{children}</View>;
}

function LoadingRow({ label }: { label: string }) {
	return (
		<View style={{ alignItems: 'center', paddingTop: 40 }}>
			<ArcaneLoadingView label={label} />
		</View>
	);
}

function InfoGroupView({ group }: { group: InfoGroup }) {
	return (
		<View style={{ gap: 10 }}>
			<Text
				accessibilityRole="header"
				style={[m3Type.titleMedium, { color: colors.label, paddingLeft: 4 }]}
			>
				{group.title}
			</Text>
			<View>
				{group.rows.map((row, index) => (
					<View key={`${row.label}-${index}`}>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>{row.label}</Text>
							<Text
								selectable
								style={[
									m3Type.bodyMedium,
									{
										color: colors.label,
										flex: 1,
										textAlign: 'right',
										fontVariant: ['tabular-nums']
									}
								]}
							>
								{row.value}
							</Text>
						</View>
						<View style={{ height: 1, marginLeft: 12, backgroundColor: colors.separator }} />
					</View>
				))}
			</View>
		</View>
	);
}

function HeaderCard({ model }: { model: EnvironmentDetailModel }) {
	const accent = useAccentColor();
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 14,
				paddingVertical: 12,
				paddingHorizontal: 16
			}}
		>
			<View
				style={{
					width: 48,
					height: 48,
					borderRadius: 24,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: m3.surfaceContainerHighest
				}}
			>
				<Icon name="server.rack" size={24} color={accent} />
			</View>
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={[m3Type.titleMedium, { color: colors.label }]}>{model.title}</Text>
				{model.versionInfo ? (
					<Text
						style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
					>{`Arcane ${model.versionInfo.displayVersion}`}</Text>
				) : (
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{model.versionError === undefined ? 'Checking version…' : 'Version unavailable'}
					</Text>
				)}
			</View>
			<ResourceStatusBadge
				status={headerStatus(model.environment, model.environmentError)}
				usesCardStyle
			/>
		</View>
	);
}

function NavigationRow({
	title,
	icon,
	footer,
	onPress
}: {
	title: string;
	icon: string;
	footer: string;
	onPress: () => void;
}) {
	return (
		<View style={{ paddingTop: 16 }}>
			<MaterialListGroup>
				<Pressable
					onPress={onPress}
					accessibilityRole="button"
					android_ripple={{ color: colors.separator as string }}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 16,
						minHeight: 56,
						paddingHorizontal: 16
					}}
				>
					<Icon name={icon} size={22} color={colors.secondaryLabel} />
					<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
					<Icon name="chevron.right" size={18} color={colors.secondaryLabel} />
				</Pressable>
			</MaterialListGroup>
			<Text
				style={[
					m3Type.bodySmall,
					{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
				]}
			>
				{footer}
			</Text>
		</View>
	);
}

/** Material 3 single-select segmented button. */
function SegmentedButtons<Value extends string>({
	options,
	selection,
	onSelect
}: {
	options: Value[];
	selection: Value;
	onSelect: (value: Value) => void;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				marginHorizontal: 16,
				marginTop: 16,
				borderRadius: 20,
				borderWidth: 1,
				borderColor: m3.outline,
				overflow: 'hidden'
			}}
		>
			{options.map((option, index) => {
				const selected = option === selection;
				return (
					<Pressable
						key={option}
						onPress={() => onSelect(option)}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						android_ripple={{ color: colors.separator as string }}
						style={{
							flex: 1,
							minHeight: 40,
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 6,
							backgroundColor: selected ? m3.secondaryContainer : 'transparent',
							borderLeftWidth: index > 0 ? 1 : 0,
							borderLeftColor: m3.outline
						}}
					>
						{selected ? <Icon name="checkmark" size={16} color={m3.onSecondaryContainer} /> : null}
						<Text
							style={[
								m3Type.labelLarge,
								{ color: selected ? m3.onSecondaryContainer : colors.label }
							]}
						>
							{option}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function SettingsContent({
	model,
	sections
}: {
	model: EnvironmentDetailModel;
	sections: SettingsSectionDef[];
}) {
	if (model.draftHasLoaded) {
		return (
			<>
				<SettingsSectionsView
					sections={sections}
					draft={model.draft}
					draftToken={model.draftToken}
					disabled={!model.canEditSettings}
				/>
				<SettingsErrorSection draft={model.draft} />
			</>
		);
	}
	return (
		<FlatRow>
			{model.draftError !== undefined ? (
				<ErrorBanner message={model.draftError} severity="warning" />
			) : (
				<LoadingRow label="Loading settings…" />
			)}
		</FlatRow>
	);
}

function TabContent({ model }: { model: EnvironmentDetailModel }) {
	switch (model.selectedTab) {
		case 'Info':
			return (
				<FlatRow>
					{model.dockerInfo ? (
						<View style={{ gap: 12 }}>
							{[
								...systemInfoGroups(model.dockerInfo, model.versionInfo),
								...dockerInfoGroups(model.dockerInfo)
							].map((group) => (
								<InfoGroupView key={group.title} group={group} />
							))}
						</View>
					) : model.staticError === undefined ? (
						<LoadingRow label="Loading system information…" />
					) : null}
					{model.staticError !== undefined ? (
						<ErrorBanner message={model.staticError} severity="warning" />
					) : null}
					{model.versionError !== undefined ? (
						<ErrorBanner message={model.versionError} severity="warning" />
					) : null}
				</FlatRow>
			);
		case 'Connection':
			return (
				<FlatRow>
					{model.environment ? (
						<EnvironmentConnectionView
							environment={model.environment}
							details={model.details}
							managerURL={model.managerURL}
							isAvailable={model.environmentError === undefined}
						/>
					) : model.isLoading ? (
						<LoadingRow label="Loading connection details…" />
					) : null}
					{model.environmentError !== undefined ? (
						<ErrorBanner message={model.environmentError} severity="warning" />
					) : null}
				</FlatRow>
			);
		case 'Features':
			return <SettingsContent model={model} sections={environmentFeatureSections} />;
		case 'Storage':
			return <SettingsContent model={model} sections={environmentStorageSections} />;
		case 'Docker':
			return <SettingsContent model={model} sections={environmentDockerSections} />;
		case 'Security':
			return (
				<>
					<SegmentedButtons<EnvironmentSecuritySection>
						options={environmentSecuritySectionCases}
						selection={model.securitySection}
						onSelect={model.setSecuritySection}
					/>
					<SettingsContent
						model={model}
						sections={environmentSecuritySections[model.securitySection]}
					/>
				</>
			);
		case 'Automations':
			return (
				<>
					<SettingsContent model={model} sections={environmentAutomationSections} />
					<NavigationRow
						title="Schedules"
						icon="clock.arrow.2.circlepath"
						footer="How often each job runs."
						onPress={model.openSchedules}
					/>
				</>
			);
		case 'GitOps':
			return (
				<NavigationRow
					title="GitOps Syncs"
					icon="arrow.triangle.merge"
					footer="Projects kept in sync with Git repositories in this environment."
					onPress={model.openGitOps}
				/>
			);
	}
}

export function EnvironmentDetailScreen(props: { id?: string; name?: string }) {
	const params = useLocalSearchParams<{ id: string; name?: string }>();
	const id = props.id ?? params.id ?? '';
	const name = props.name ?? params.name ?? id;
	const model = useEnvironmentDetail(id, name);
	const [refreshing, setRefreshing] = useState(false);
	const accent = useAccentColor();

	return (
		<>
			<Stack.Screen options={{ title: model.title }} />
			{model.isAdmin ? (
				<AndroidToolbar
					items={[
						{
							kind: 'menu',
							id: 'more',
							icon: 'ellipsis.circle',
							label: 'More options',
							items: [{ id: 'upgrade', title: 'Upgrade Arcane', onPress: model.openUpgrade }]
						}
					]}
				/>
			) : null}
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<ScrollView
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{ paddingBottom: 16 }}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							colors={[accent]}
							onRefresh={() => {
								setRefreshing(true);
								void model.refresh().finally(() => setRefreshing(false));
							}}
						/>
					}
				>
					<HeaderCard model={model} />
					<ScrollableTabBar
						selection={model.selectedTab}
						onSelectionChange={model.setSelectedTab}
						options={model.tabOptions}
						accessibilityLabel="Environment detail sections"
					/>
					<TabContent model={model} />
					{model.showsSaveBar ? <SaveBarClearanceSection /> : null}
				</ScrollView>
				<SettingsSaveBar
					isPresented={model.showsSaveBar}
					hasChanges={model.hasChanges}
					isSaving={model.isSaving}
					canSave={model.canEditSettings}
					isInteractionDisabled={model.draftIsLoading}
					onSave={model.saveSettings}
					onRevert={model.revertSettings}
				/>
			</View>
		</>
	);
}
