/**
 * Port of `EnvironmentDetailView` (EnvironmentDetailView.swift): header card
 * and section tabs, then the selected tab — Info (system + Docker info),
 * Connection, the environment settings tabs (shared draft + floating save
 * bar), and GitOps.
 */
import { Host } from '@/ui/host';
import {
	Button,
	Divider,
	HStack,
	Label,
	List,
	Picker,
	RNHostView,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	buttonStyle,
	contentShape,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	listRowBackground,
	listRowInsets,
	listRowSeparator,
	listSectionSpacing,
	listStyle,
	monospacedDigit,
	padding,
	pickerStyle,
	refreshable,
	shapes,
	tag
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ErrorBanner } from '@/ui/components/error-banner';
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
import { AppToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';

import { EnvironmentConnectionView } from './environment-connection-view';
import {
	dockerInfoGroups,
	headerStatus,
	systemInfoGroups,
	type InfoGroup
} from './environment-detail-model';
import { useEnvironmentDetail, type EnvironmentDetailModel } from './use-environment-detail';

/** `Color(uiColor: .tertiarySystemFill)`. */
const tertiaryFill = { light: '#7676801F', dark: '#7676803D' } as const;

const flatRowModifiers = [
	listRowBackground('#00000000'),
	listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
	listRowSeparator('hidden')
];

/** Full-width content without the grouped-row background. */
function FlatRow({ children }: { children: ReactNode }) {
	return (
		<Section>
			<VStack alignment="leading" spacing={12} modifiers={flatRowModifiers}>
				{children}
			</VStack>
		</Section>
	);
}

/** `ArcaneLoadingView(label).frame(maxWidth: .infinity).padding(.top, 40)`. */
function LoadingRow({ label }: { label: string }) {
	return (
		<VStack modifiers={[frame({ maxWidth: Infinity }), padding({ top: 40 })]}>
			<ArcaneLoadingViewSwiftUI label={label} fillsWidth />
		</VStack>
	);
}

/** `DashboardInfoGroup(title:usesCardBackground: false)` + `DashboardInfoRow`s. */
function InfoGroupView({ group }: { group: InfoGroup }) {
	return (
		<VStack alignment="leading" spacing={10}>
			<Text modifiers={[font({ textStyle: 'headline' }), padding({ leading: 4 })]}>
				{group.title}
			</Text>
			<VStack spacing={0}>
				{group.rows.map((row, index) => (
					<VStack key={`${row.label}-${index}`} spacing={0}>
						<HStack modifiers={[font({ textStyle: 'subheadline' }), padding({ all: 12 })]}>
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{row.label}
							</Text>
							<Spacer />
							{/* Swift lets long values (Daemon ID) wrap; expo's row would otherwise truncate. */}
							<Text
								modifiers={[monospacedDigit(), fixedSize({ horizontal: false, vertical: true })]}
							>
								{row.value}
							</Text>
						</HStack>
						<Divider modifiers={[padding({ leading: 12 })]} />
					</VStack>
				))}
			</VStack>
		</VStack>
	);
}

function HeaderCard({ model }: { model: EnvironmentDetailModel }) {
	const accent = useAccentColor();
	const isDark = useIsDark();
	return (
		<HStack spacing={14} modifiers={[padding({ vertical: 12 })]}>
			<Image
				systemName="server.rack"
				modifiers={[
					font({ textStyle: 'title2' }),
					foregroundStyle(accent),
					frame({ width: 48, height: 48 }),
					background(tertiaryFill[isDark ? 'dark' : 'light'], shapes.circle())
				]}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{model.title}</Text>
				{model.versionInfo ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption', design: 'monospaced' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{`Arcane ${model.versionInfo.displayVersion}`}
					</Text>
				) : (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{model.versionError === undefined ? 'Checking version…' : 'Version unavailable'}
					</Text>
				)}
			</VStack>
			<Spacer />
			<ResourceStatusBadge
				status={headerStatus(model.environment, model.environmentError)}
				usesCardStyle
			/>
		</HStack>
	);
}

function NavigationRow({
	title,
	systemImage,
	onPress
}: {
	title: string;
	systemImage: string;
	onPress: () => void;
}) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}>
			<HStack modifiers={[contentShape(shapes.rectangle())]}>
				<Label title={title} systemImage={systemImage as SFSymbol} />
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}

/** Settings tab sections, or a placeholder while they load or when the environment can't be reached. */
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
						<VStack alignment="leading" spacing={12}>
							{[
								...systemInfoGroups(model.dockerInfo, model.versionInfo),
								...dockerInfoGroups(model.dockerInfo)
							].map((group) => (
								<InfoGroupView key={group.title} group={group} />
							))}
						</VStack>
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
					<Section
						modifiers={[
							listRowBackground('#00000000'),
							listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 })
						]}
					>
						<Picker
							label="Security"
							selection={model.securitySection}
							onSelectionChange={(value: EnvironmentSecuritySection) =>
								model.setSecuritySection(value)
							}
							modifiers={[pickerStyle('segmented')]}
						>
							{environmentSecuritySectionCases.map((section) => (
								<Text key={section} modifiers={[tag(section)]}>
									{section}
								</Text>
							))}
						</Picker>
					</Section>
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
					<Section footer={<Text>How often each job runs.</Text>}>
						<NavigationRow
							title="Schedules"
							systemImage="clock.arrow.2.circlepath"
							onPress={model.openSchedules}
						/>
					</Section>
				</>
			);
		case 'GitOps':
			return (
				<Section
					footer={<Text>Projects kept in sync with Git repositories in this environment.</Text>}
				>
					<NavigationRow
						title="GitOps Syncs"
						systemImage="arrow.triangle.merge"
						onPress={model.openGitOps}
					/>
				</Section>
			);
	}
}

export function EnvironmentDetailScreen(props: { id?: string; name?: string }) {
	const params = useLocalSearchParams<{ id: string; name?: string }>();
	const id = props.id ?? params.id ?? '';
	const name = props.name ?? params.name ?? id;
	const model = useEnvironmentDetail(id, name);

	return (
		<>
			<Stack.Screen
				options={{ title: model.title, headerLargeTitleEnabled: false, headerTransparent: false }}
			/>
			{model.isAdmin ? (
				<AppToolbar>
					<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="More options">
						<Stack.Toolbar.MenuAction icon="arrow.up.circle" onPress={model.openUpgrade}>
							Upgrade Arcane
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
				</AppToolbar>
			) : null}
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<Host style={{ flex: 1 }}>
					<List
						modifiers={[
							listStyle('insetGrouped'),
							listSectionSpacing(16),
							refreshable(model.refresh)
						]}
					>
						<Section>
							<VStack spacing={0} modifiers={flatRowModifiers}>
								<HeaderCard model={model} />
								{/* RN host inside SwiftUI needs a fixed frame (AGENTS.md); ScrollableTabBar is 12 + 30pt pill + 12. */}
								<VStack modifiers={[frame({ height: 54 })]}>
									<RNHostView matchContents={{ vertical: true }}>
										<View style={{ width: '100%' }}>
											<ScrollableTabBar
												selection={model.selectedTab}
												onSelectionChange={model.setSelectedTab}
												options={model.tabOptions}
												accessibilityLabel="Environment detail sections"
											/>
										</View>
									</RNHostView>
								</VStack>
							</VStack>
						</Section>
						<TabContent model={model} />
						{model.showsSaveBar ? <SaveBarClearanceSection /> : null}
					</List>
				</Host>
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
