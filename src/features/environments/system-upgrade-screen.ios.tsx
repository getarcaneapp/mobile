/**
 * Port of `SystemUpgradeView` (Views/Settings/System/SystemUpgradeView.swift).
 * The Dashboard card presents it as a sheet (`NavigationStack` + Done);
 * Environment Detail pushes it (`navigationDestination`).
 */
import { Host } from '@/ui/host';
import {
	Button,
	Circle,
	ContentUnavailableView,
	HStack,
	Label,
	NavigationStack,
	ScrollView,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	background,
	buttonStyle,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	tint,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { groupedHex, useIsDark } from '@/ui/components/accessibility';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import {
	DeleteConfirmationHost,
	singleActionConfig,
	useDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import { glassEffectCompat } from '@/ui/components/swiftui-surfaces';
import { ToastHost } from '@/ui/toast';

import {
	systemUpgradeConfirmationHost,
	systemUpgradeCopy,
	useSystemUpgrade,
	useSystemUpgradeRoute,
	type SystemUpgradeModel
} from './system-upgrade-model';

const cardGlass = (cornerRadius: number) =>
	glassEffectCompat({ shape: 'roundedRectangle', cornerRadius });

function Unavailable({
	title,
	systemImage,
	description
}: {
	title: string;
	systemImage: 'lock.shield' | 'exclamationmark.triangle';
	description: string;
}) {
	return (
		<ContentUnavailableView
			title={title}
			systemImage={systemImage}
			description={description}
			modifiers={[frame({ maxWidth: Infinity, minHeight: 240 })]}
		/>
	);
}

function HeroCard({
	tint: tintColor,
	icon,
	title,
	subtitle
}: {
	tint: string;
	icon: SFSymbol;
	title: string;
	subtitle: string;
}) {
	return (
		<VStack
			spacing={16}
			modifiers={[
				frame({ maxWidth: Infinity }),
				padding({ vertical: 24, horizontal: 20 }),
				cardGlass(Radius.hero)
			]}
		>
			<ZStack
				modifiers={[glassEffectCompat({ tint: withOpacity(tintColor, 0.25), shape: 'circle' })]}
			>
				<Circle
					modifiers={[
						foregroundStyle(withOpacity(tintColor, 0.18)),
						frame({ width: 96, height: 96 })
					]}
				/>
				<Image
					systemName={icon}
					modifiers={[font({ size: 40, weight: 'semibold' }), foregroundStyle(tintColor)]}
				/>
			</ZStack>
			<VStack spacing={6}>
				<Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{title}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						multilineTextAlignment('center')
					]}
				>
					{subtitle}
				</Text>
			</VStack>
		</VStack>
	);
}

function InfoCard({
	icon,
	tint: tintColor,
	title,
	body
}: {
	icon: SFSymbol;
	tint: string;
	title: string;
	body: string;
}) {
	return (
		<VStack
			alignment="leading"
			spacing={10}
			modifiers={[
				padding({ all: 20 }),
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				cardGlass(Radius.card)
			]}
		>
			<HStack spacing={8}>
				<Image
					systemName={icon}
					modifiers={[
						font({ textStyle: 'callout', weight: 'semibold' }),
						foregroundStyle(tintColor)
					]}
				/>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{title}</Text>
			</HStack>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					fixedSize({ horizontal: false, vertical: true })
				]}
			>
				{body}
			</Text>
		</VStack>
	);
}

function LoadingCard() {
	return (
		<VStack
			spacing={16}
			modifiers={[
				frame({ maxWidth: Infinity, minHeight: 200 }),
				padding({ vertical: 24, horizontal: 20 }),
				cardGlass(Radius.hero)
			]}
		>
			<ArcaneLoadingViewSwiftUI />
			<Text
				modifiers={[
					font({ textStyle: 'subheadline' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				Checking for upgrade…
			</Text>
		</VStack>
	);
}

function TriggeringCard() {
	return (
		<VStack
			spacing={16}
			modifiers={[
				frame({ maxWidth: Infinity }),
				padding({ vertical: 24, horizontal: 20 }),
				cardGlass(Radius.hero)
			]}
		>
			<ZStack
				modifiers={[
					glassEffectCompat({ tint: withOpacity(systemColors.blue, 0.25), shape: 'circle' })
				]}
			>
				<Circle
					modifiers={[
						foregroundStyle(withOpacity(systemColors.blue, 0.18)),
						frame({ width: 96, height: 96 })
					]}
				/>
				<ArcaneLoadingViewSwiftUI />
			</ZStack>
			<VStack spacing={6}>
				<Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>Starting upgrade…</Text>
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					Asking Arcane to restart
				</Text>
			</VStack>
		</VStack>
	);
}

function PhaseContent({ model, onUpgrade }: { model: SystemUpgradeModel; onUpgrade: () => void }) {
	if (!model.isAdmin) {
		return (
			<Unavailable
				title="Admins Only"
				systemImage="lock.shield"
				description="Upgrading Arcane requires an administrator account."
			/>
		);
	}
	const { phase } = model;
	switch (phase.kind) {
		case 'checking':
			return <LoadingCard />;
		case 'ready': {
			const { result } = phase;
			return (
				<VStack spacing={16}>
					<HeroCard
						tint={result.canUpgrade ? systemColors.blue : systemColors.gray}
						icon={result.canUpgrade ? 'arrow.up.circle.fill' : 'lock.circle.fill'}
						title={result.canUpgrade ? 'Upgrade Available' : 'Upgrade Unavailable'}
						subtitle={result.message}
					/>
					{result.canUpgrade ? (
						<>
							<InfoCard
								icon="info.circle.fill"
								tint={systemColors.blue}
								title="What happens next"
								body={systemUpgradeCopy.whatHappensNext}
							/>
							<Button
								role="destructive"
								onPress={onUpgrade}
								modifiers={[buttonStyle('borderedProminent'), tint(systemColors.red)]}
							>
								<Label
									title="Upgrade Arcane"
									systemImage="arrow.up.circle.fill"
									modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 8 })]}
								/>
							</Button>
						</>
					) : (
						<InfoCard
							icon="exclamationmark.triangle.fill"
							tint={systemColors.orange}
							title="Self-upgrade is not supported here"
							body={systemUpgradeCopy.unsupported}
						/>
					)}
				</VStack>
			);
		}
		case 'checkFailed':
			return (
				<Unavailable
					title="Couldn't Check for Upgrade"
					systemImage="exclamationmark.triangle"
					description={phase.message}
				/>
			);
		case 'triggering':
			return <TriggeringCard />;
		case 'triggered':
			return (
				<VStack spacing={20}>
					<HeroCard
						tint={systemColors.green}
						icon="checkmark.circle.fill"
						title="Upgrade Initiated"
						subtitle={phase.message}
					/>
					<InfoCard
						icon="antenna.radiowaves.left.and.right"
						tint={systemColors.blue}
						title="Reconnecting shortly"
						body={systemUpgradeCopy.reconnecting}
					/>
					<ArcaneLoadingViewSwiftUI />
				</VStack>
			);
		case 'triggerFailed':
			return (
				<>
					<Unavailable
						title="Upgrade Failed"
						systemImage="exclamationmark.triangle"
						description={phase.message}
					/>
					<Button onPress={model.checkUpgrade} modifiers={[buttonStyle('bordered')]}>
						<Label
							title="Check Again"
							systemImage="arrow.clockwise"
							modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 6 })]}
						/>
					</Button>
				</>
			);
	}
}

export function SystemUpgradeScreen() {
	const router = useRouter();
	const accent = useAccentColor();
	const isDark = useIsDark();
	const route = useSystemUpgradeRoute();
	const model = useSystemUpgrade(route.environmentID, route.environmentName);
	const [confirming, setConfirming] = useState(false);
	useDeleteConfirmation(
		confirming,
		setConfirming,
		singleActionConfig({
			title: model.confirmation.title,
			message: model.confirmation.message,
			icon: model.confirmation.icon,
			confirmTitle: model.confirmation.confirmTitle,
			onConfirm: model.triggerUpgrade
		}),
		systemUpgradeConfirmationHost
	);

	const showsRefresh = model.isAdmin && model.phase.kind === 'ready';
	const scroll = (extraModifiers: ModifierConfig[]): ReactNode => (
		<ScrollView
			modifiers={[
				background(groupedHex[isDark ? 'dark' : 'light'].systemGroupedBackground),
				...extraModifiers
			]}
		>
			<VStack spacing={20} modifiers={[padding({ horizontal: 16 }), padding({ vertical: 20 })]}>
				<PhaseContent model={model} onUpgrade={() => setConfirming(true)} />
			</VStack>
		</ScrollView>
	);

	if (!route.isSheet) {
		return (
			<View style={{ flex: 1 }}>
				<Stack.Screen options={{ title: 'Upgrade Arcane', headerLargeTitleEnabled: false }} />
				{showsRefresh ? (
					<AppToolbar placement="right" tintColor={accent}>
						<Stack.Toolbar.Button
							icon="arrow.clockwise"
							accessibilityLabel="Refresh"
							onPress={model.checkUpgrade}
						/>
					</AppToolbar>
				) : null}
				<Host style={{ flex: 1 }}>{scroll([])}</Host>
				<DeleteConfirmationHost hostID={systemUpgradeConfirmationHost} />
			</View>
		);
	}

	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						{scroll([navigationTitle('Upgrade Arcane'), navigationBarTitleDisplayMode('inline')])}
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Done"
									onPress={() => router.back()}
									modifiers={[foregroundStyle(accent)]}
								/>
							</ToolbarItem>
							{showsRefresh ? (
								<ToolbarItem placement="topBarTrailing">
									<Button
										systemImage="arrow.clockwise"
										onPress={model.checkUpgrade}
										modifiers={[tint(accent), accessibilityLabel('Refresh')]}
									/>
								</ToolbarItem>
							) : null}
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<DeleteConfirmationHost hostID={systemUpgradeConfirmationHost} />
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
