import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import {
	DeleteConfirmationHost,
	singleActionConfig,
	useDeleteConfirmation
} from '@/ui/components/delete-confirmation';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { ToastHost } from '@/ui/toast';

import {
	systemUpgradeConfirmationHost,
	systemUpgradeCopy,
	useSystemUpgrade,
	useSystemUpgradeRoute,
	type SystemUpgradeModel
} from './system-upgrade-model';

const cardStyle = (radius: number) => ({
	backgroundColor: colors.secondarySystemGroupedBackground,
	borderRadius: radius,
	borderCurve: 'continuous' as const
});

function Unavailable({ icon, title, message }: { icon: string; title: string; message: string }) {
	return (
		<View
			style={{
				minHeight: 240,
				alignItems: 'center',
				justifyContent: 'center',
				gap: 8,
				paddingHorizontal: 16
			}}
		>
			<Icon name={icon} size={44} color={colors.secondaryLabel} />
			<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
				{message}
			</Text>
		</View>
	);
}

function IconWell({ tint, children }: { tint: string; children: ReactNode }) {
	return (
		<View
			style={{
				width: 96,
				height: 96,
				borderRadius: 48,
				backgroundColor: withOpacity(tint, 0.18),
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			{children}
		</View>
	);
}

function HeroCard({
	tint,
	icon,
	title,
	subtitle
}: {
	tint: string;
	icon: string;
	title: string;
	subtitle: string;
}) {
	return (
		<View
			style={[
				cardStyle(Radius.hero),
				{ alignItems: 'center', gap: 16, paddingVertical: 24, paddingHorizontal: 20 }
			]}
		>
			<IconWell tint={tint}>
				<Icon name={icon} size={44} color={tint} />
			</IconWell>
			<View style={{ alignItems: 'center', gap: 6 }}>
				<Text style={[m3Type.headlineSmall, { color: colors.label, textAlign: 'center' }]}>
					{title}
				</Text>
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{subtitle}
				</Text>
			</View>
		</View>
	);
}

function InfoCard({
	icon,
	tint,
	title,
	body
}: {
	icon: string;
	tint: string;
	title: string;
	body: string;
}) {
	return (
		<View style={[cardStyle(Radius.card), { gap: 10, padding: 20 }]}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<Icon name={icon} size={20} color={tint} />
				<Text style={[m3Type.titleMedium, { color: colors.label, flex: 1 }]}>{title}</Text>
			</View>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>{body}</Text>
		</View>
	);
}

function M3Button({
	title,
	icon,
	onPress,
	variant
}: {
	title: string;
	icon: string;
	onPress: () => void;
	variant: 'filledDestructive' | 'outlined';
}) {
	const filled = variant === 'filledDestructive';
	const content = filled ? '#FFFFFF' : (m3.primary as string);
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: filled ? '#FFFFFF33' : (colors.separator as string) }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 8,
				minHeight: 48,
				borderRadius: 24,
				overflow: 'hidden',
				backgroundColor: filled ? systemColors.red : undefined,
				borderWidth: filled ? 0 : 1,
				borderColor: m3.outline
			}}
		>
			<Icon name={icon} size={18} color={content} />
			<Text style={[m3Type.labelLarge, { color: content }]}>{title}</Text>
		</Pressable>
	);
}

function PhaseContent({ model, onUpgrade }: { model: SystemUpgradeModel; onUpgrade: () => void }) {
	if (!model.isAdmin) {
		return (
			<Unavailable
				icon="lock.shield"
				title="Admins Only"
				message="Upgrading Arcane requires an administrator account."
			/>
		);
	}
	const { phase } = model;
	switch (phase.kind) {
		case 'checking':
			return (
				<View
					style={[
						cardStyle(Radius.hero),
						{
							minHeight: 200,
							alignItems: 'center',
							justifyContent: 'center',
							gap: 16,
							paddingVertical: 24,
							paddingHorizontal: 20
						}
					]}
				>
					<ArcaneLoadingView />
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						Checking for upgrade…
					</Text>
				</View>
			);
		case 'ready': {
			const { result } = phase;
			return (
				<View style={{ gap: 16 }}>
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
							<M3Button
								title="Upgrade Arcane"
								icon="arrow.up.circle.fill"
								onPress={onUpgrade}
								variant="filledDestructive"
							/>
						</>
					) : (
						<InfoCard
							icon="exclamationmark.triangle.fill"
							tint={systemColors.orange}
							title="Self-upgrade is not supported here"
							body={systemUpgradeCopy.unsupported}
						/>
					)}
				</View>
			);
		}
		case 'checkFailed':
			return (
				<Unavailable
					icon="exclamationmark.triangle"
					title="Couldn't Check for Upgrade"
					message={phase.message}
				/>
			);
		case 'triggering':
			return (
				<View
					style={[
						cardStyle(Radius.hero),
						{ alignItems: 'center', gap: 16, paddingVertical: 24, paddingHorizontal: 20 }
					]}
				>
					<IconWell tint={systemColors.blue}>
						<ArcaneLoadingView />
					</IconWell>
					<View style={{ alignItems: 'center', gap: 6 }}>
						<Text style={[m3Type.headlineSmall, { color: colors.label }]}>Starting upgrade…</Text>
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							Asking Arcane to restart
						</Text>
					</View>
				</View>
			);
		case 'triggered':
			return (
				<View style={{ gap: 20 }}>
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
					<View style={{ alignItems: 'center' }}>
						<ArcaneLoadingView />
					</View>
				</View>
			);
		case 'triggerFailed':
			return (
				<View style={{ gap: 20 }}>
					<Unavailable
						icon="exclamationmark.triangle"
						title="Upgrade Failed"
						message={phase.message}
					/>
					<M3Button
						title="Check Again"
						icon="arrow.clockwise"
						onPress={model.checkUpgrade}
						variant="outlined"
					/>
				</View>
			);
	}
}

export function SystemUpgradeScreen() {
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

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: 'Upgrade Arcane', headerShown: true }} />
			{showsRefresh ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.View>
						<Pressable
							onPress={model.checkUpgrade}
							accessibilityRole="button"
							accessibilityLabel="Refresh"
							android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
							style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
						>
							<Icon name="arrow.clockwise" size={24} color={m3.onSurfaceVariant} />
						</Pressable>
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : null}
			<ScrollView contentContainerStyle={{ gap: 20, paddingHorizontal: 16, paddingVertical: 20 }}>
				<PhaseContent model={model} onUpgrade={() => setConfirming(true)} />
			</ScrollView>
			<DeleteConfirmationHost hostID={systemUpgradeConfirmationHost} />
			{route.isSheet ? <ToastHost reservesTabBarSpace={false} /> : null}
		</View>
	);
}
