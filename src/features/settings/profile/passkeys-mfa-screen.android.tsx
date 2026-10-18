import { MenuView } from '@react-native-menu/menu';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View, type ColorValue } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import type { PasskeySummary } from '@/sdk/models/auth/Passkey';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, TextButtonRow, ValueRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { TextPromptDialog } from './android-overlays';
import { StepUpSheet } from './step-up-sheet';
import { passkeyRowDetails, usePasskeysMFA, type PasskeysMFAModel } from './use-passkeys-mfa';

const Divider = () => (
	<View style={{ height: 0.5, marginHorizontal: 16, backgroundColor: colors.separator }} />
);

function Meta({
	icon,
	text,
	color = colors.secondaryLabel,
	bold
}: {
	icon: string;
	text: string;
	color?: ColorValue;
	bold?: boolean;
}) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
			<Icon name={icon} size={14} color={color} />
			<Text style={[m3Type.bodySmall, { color }, bold && { fontWeight: '600' }]}>{text}</Text>
		</View>
	);
}

function PasskeyRow({ passkey, model }: { passkey: PasskeySummary; model: PasskeysMFAModel }) {
	const details = passkeyRowDetails(passkey);
	return (
		<View style={{ paddingLeft: 16, paddingRight: 4, paddingVertical: 12, gap: 8 }}>
			<View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
				<View style={{ flex: 1, gap: 2 }}>
					<Text style={[m3Type.titleMedium, { color: colors.label }]}>{passkey.name}</Text>
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{passkey.rpId}</Text>
				</View>
				<MenuView
					actions={[
						{ id: 'rename', title: 'Rename' },
						{
							id: 'delete',
							title: 'Delete',
							attributes: { destructive: true, disabled: model.deleteDisabled }
						}
					]}
					onPressAction={({ nativeEvent }) => {
						if (nativeEvent.event === 'rename') model.beginRename(passkey);
						if (nativeEvent.event === 'delete') model.requestDelete(passkey);
					}}
				>
					<View
						accessible
						accessibilityRole="button"
						accessibilityLabel={`Actions for ${passkey.name}`}
						style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
					>
						<Icon name="ellipsis.circle" size={24} color={m3.onSurfaceVariant} />
					</View>
				</MenuView>
			</View>
			<View style={{ flexDirection: 'row', gap: 10 }}>
				<Meta icon="calendar" text={details.created} />
				{details.lastUsed ? <Meta icon="clock" text={details.lastUsed} /> : null}
			</View>
			{passkey.cloneWarning ? (
				<Meta
					icon="exclamationmark.triangle.fill"
					text="Authenticator clone warning"
					color={systemColors.orange}
					bold
				/>
			) : passkey.backupState ? (
				<Meta icon="icloud.and.arrow.up" text="Synced passkey" />
			) : null}
		</View>
	);
}

export function PasskeysMFAScreen() {
	const model = usePasskeysMFA();
	const status = model.mfaStatus;
	const [isRefreshing, setIsRefreshing] = useState(false);
	const refresh = async () => {
		setIsRefreshing(true);
		await withCleanup(
			async () => {
				await model.refresh();
			},
			() => setIsRefreshing(false)
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: 'Passkeys & MFA' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'add',
						icon: 'plus',
						label: 'Add Passkey',
						disabled: model.addDisabled,
						onPress: model.beginAdd
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
				refreshControl={
					<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} />
				}
			>
				{model.showsInitialLoading ? (
					<View style={{ padding: 32, alignItems: 'center' }}>
						<ArcaneLoadingView label="Loading security settings…" />
					</View>
				) : (
					<>
						<M3Section title="Multi-Factor Authentication" footer={model.mfaFooter}>
							<ValueRow
								title="Status"
								value={model.mfaEnabled ? 'Enabled' : 'Disabled'}
								valueColor={model.mfaEnabled ? systemColors.green : undefined}
								selectable={false}
							/>
							{status?.enabled ? (
								<>
									<ValueRow
										title="Recovery Codes"
										value={String(status.recoveryCodesRemaining)}
										selectable={false}
									/>
									<TextButtonRow
										title="Generate New Recovery Codes"
										onPress={model.regenerateRecoveryCodes}
									/>
									<TextButtonRow
										title="Disable Multi-Factor Authentication"
										destructive
										onPress={model.disableMFA}
									/>
								</>
							) : (
								<TextButtonRow
									title="Enable Multi-Factor Authentication"
									onPress={model.enableMFA}
									disabled={model.passkeys.length === 0}
								/>
							)}
						</M3Section>

						<M3Section title="Passkeys">
							{model.passkeys.length === 0 ? (
								<View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
									<Icon name="person.badge.key" size={40} color={colors.secondaryLabel} />
									<Text style={[m3Type.titleMedium, { color: colors.label }]}>No Passkeys</Text>
									<Text
										style={[
											m3Type.bodyMedium,
											{ color: colors.secondaryLabel, textAlign: 'center' }
										]}
									>
										{model.emptyDescription}
									</Text>
								</View>
							) : (
								model.passkeys.map((passkey, index) => (
									<View key={passkey.id}>
										{index > 0 ? <Divider /> : null}
										<PasskeyRow passkey={passkey} model={model} />
									</View>
								))
							)}
						</M3Section>
					</>
				)}
			</ScrollView>

			<TextPromptDialog
				visible={model.showsAddPrompt}
				title="Add Passkey"
				message="Give this passkey a name you will recognize on this device."
				placeholder="Passkey name (optional)"
				value={model.newPasskeyName}
				onChangeText={model.setNewPasskeyName}
				confirmTitle="Continue"
				onConfirm={model.confirmAdd}
				onCancel={model.dismissAddPrompt}
			/>
			<TextPromptDialog
				visible={model.renamingPasskey !== undefined}
				title="Rename Passkey"
				placeholder="Passkey name"
				value={model.renamedPasskeyName}
				onChangeText={model.setRenamedPasskeyName}
				confirmTitle="Save"
				confirmDisabled={model.renameDisabled}
				onConfirm={model.confirmRename}
				onCancel={model.cancelRename}
			/>
			<StepUpSheet
				isPresented={model.showsStepUp}
				allowsPassword={model.stepUpAllowsPassword}
				allowsPasskey={model.stepUpAllowsPasskey}
				authenticateWithPassword={model.authenticateStepUpWithPassword}
				authenticateWithPasskey={model.authenticateStepUpWithPasskey}
				cancel={model.cancelStepUp}
				onDismissed={model.stepUpDismissed}
			/>
		</>
	);
}
