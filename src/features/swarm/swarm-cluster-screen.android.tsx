import { MenuView } from '@react-native-menu/menu';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import { ActionItem, SecondaryText } from '@/features/networks/android-parts';

import { PromptDialog } from './swarm-dialogs';
import { copyToClipboard, CopyValueRow } from './swarm-parts';
import { maskedToken, useSwarmCluster, type SwarmClusterModel } from './use-swarm-cluster';

function IconButton({
	icon,
	label,
	onPress
}: {
	icon: string;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true, radius: 20 }}
			style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
		>
			<Icon name={icon} size={20} color={m3.primary} />
		</Pressable>
	);
}

function TokenRow({
	model,
	title,
	token
}: {
	model: SwarmClusterModel;
	title: string;
	token: string;
}) {
	const isRevealed = model.revealed.has(title);
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 6 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Text style={[m3Type.titleSmall, { color: colors.label, flex: 1 }]}>{title}</Text>
				<IconButton
					icon={isRevealed ? 'eye.slash' : 'eye'}
					label={isRevealed ? `Hide ${title}` : `Reveal ${title}`}
					onPress={() => model.toggleRevealed(title)}
				/>
				<IconButton
					icon="doc.on.doc"
					label={`Copy ${title}`}
					onPress={() => void copyToClipboard(token)}
				/>
			</View>
			<Text
				selectable={isRevealed}
				numberOfLines={isRevealed ? undefined : 1}
				style={{ fontFamily: monoFamily, fontSize: 12, color: colors.secondaryLabel }}
			>
				{isRevealed ? token : maskedToken}
			</Text>
		</View>
	);
}

export function SwarmClusterScreen() {
	const model = useSwarmCluster();
	const { info, tokens } = model;
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen options={{ title: 'Cluster' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => {
							setRefreshing(true);
							void model.load().finally(() => setRefreshing(false));
						}}
					/>
				}
			>
				{info ? (
					<M3Section title="Cluster">
						<CopyValueRow title="ID" value={info.id} />
						<ValueRow title="Created" value={model.createdText} />
						<ValueRow title="Updated" value={model.updatedText} />
						{info.rootRotationInProgress ? (
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
								<Icon name="arrow.triangle.2.circlepath" size={18} color={systemColors.orange} />
								<Text style={[m3Type.bodyMedium, { color: systemColors.orange }]}>
									Root CA rotation in progress
								</Text>
							</View>
						) : null}
					</M3Section>
				) : null}
				{model.canUnlock ? (
					<>
						<M3Section
							title="Join Tokens"
							footer="Use with docker swarm join on the node you want to add."
						>
							{tokens ? (
								<>
									<TokenRow model={model} title="Worker" token={tokens.worker} />
									<TokenRow model={model} title="Manager" token={tokens.manager} />
									<MenuView
										actions={[
											{ id: 'worker', title: 'Rotate Worker Token' },
											{ id: 'manager', title: 'Rotate Manager Token' }
										]}
										onPressAction={({ nativeEvent }) =>
											model.requestRotation(nativeEvent.event === 'manager' ? 'manager' : 'worker')
										}
										shouldOpenOnLongPress={false}
									>
										<View pointerEvents="none">
											<ActionItem
												title="Rotate Tokens"
												icon="arrow.triangle.2.circlepath"
												onPress={() => {}}
											/>
										</View>
									</MenuView>
								</>
							) : (
								<View style={{ padding: 16, alignItems: 'center' }}>
									<ActivityIndicator />
								</View>
							)}
						</M3Section>
						<M3Section title="Autolock">
							{model.unlockKey !== undefined ? (
								model.unlockKey === '' ? (
									<SecondaryText text="Autolock is off, so there's no unlock key." />
								) : (
									<TokenRow model={model} title="Unlock Key" token={model.unlockKey} />
								)
							) : (
								<ActionItem title="Show Unlock Key" icon="key" onPress={model.loadUnlockKey} />
							)}
							<ActionItem title="Unlock Swarm" icon="lock.open" onPress={model.beginUnlock} />
						</M3Section>
					</>
				) : null}
				{model.canLeave ? (
					<M3Section footer="This environment's Docker host leaves the swarm.">
						<ActionItem
							title="Leave Swarm"
							icon="rectangle.portrait.and.arrow.right"
							destructive
							disabled={model.isWorking}
							onPress={model.requestLeave}
						/>
					</M3Section>
				) : null}
				{model.errorMessage ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.orange} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.orange, flex: 1 }]}>
								{model.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
			<PromptDialog
				visible={model.showUnlock}
				title="Unlock Swarm"
				message="Enter the key shown when autolock was enabled."
				fields={[
					{
						placeholder: 'Unlock key',
						value: model.unlockInput,
						onChangeText: model.setUnlockInput,
						secure: true
					}
				]}
				confirmTitle="Unlock"
				onConfirm={model.commitUnlock}
				onCancel={() => model.setShowUnlock(false)}
			/>
		</>
	);
}
