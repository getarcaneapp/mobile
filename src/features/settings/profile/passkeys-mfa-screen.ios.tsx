import { Host } from '@/ui/host';
import {
	Alert,
	Button,
	ContentUnavailableView,
	Form,
	HStack,
	Label,
	LabeledContent,
	Menu,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	disabled,
	font,
	foregroundStyle,
	padding,
	refreshable
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { PasskeySummary } from '@/sdk/models/auth/Passkey';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel } from '@/ui/components/labels';
import { AppToolbar } from '@/ui/components/toolbar';

import { BoundTextField } from '../shared/swiftui-text-field';
import { StepUpSheet } from './step-up-sheet';
import { passkeyRowDetails, usePasskeysMFA, type PasskeysMFAModel } from './use-passkeys-mfa';

function MFASection({ model }: { model: PasskeysMFAModel }) {
	const status = model.mfaStatus;
	return (
		<Section title="Multi-Factor Authentication" footer={<Text>{model.mfaFooter}</Text>}>
			<LabeledContent label="Status">
				<Text modifiers={[foregroundStyle(model.mfaEnabled ? systemColors.green : 'secondary')]}>
					{model.mfaEnabled ? 'Enabled' : 'Disabled'}
				</Text>
			</LabeledContent>
			{status?.enabled ? (
				<>
					<LabeledContent label="Recovery Codes">
						<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
							{String(status.recoveryCodesRemaining)}
						</Text>
					</LabeledContent>
					<Button label="Generate New Recovery Codes" onPress={model.regenerateRecoveryCodes} />
					<Button
						label="Disable Multi-Factor Authentication"
						role="destructive"
						onPress={model.disableMFA}
					/>
				</>
			) : (
				<Button
					label="Enable Multi-Factor Authentication"
					onPress={model.enableMFA}
					modifiers={[disabled(model.passkeys.length === 0)]}
				/>
			)}
		</Section>
	);
}

function PasskeyRow({ passkey, model }: { passkey: PasskeySummary; model: PasskeysMFAModel }) {
	const details = passkeyRowDetails(passkey);
	return (
		<VStack alignment="leading" spacing={8} modifiers={[padding({ vertical: 4 })]}>
			<HStack alignment="firstTextBaseline">
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[font({ textStyle: 'headline' })]}>{passkey.name}</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{passkey.rpId}
					</Text>
				</VStack>
				<Spacer />
				<Menu
					label={<Image systemName="ellipsis.circle" />}
					modifiers={[accessibilityLabel(`Actions for ${passkey.name}`)]}
				>
					<Button onPress={() => model.beginRename(passkey)}>
						<Label title="Rename" systemImage="pencil" />
					</Button>
					<Button
						role="destructive"
						onPress={() => model.requestDelete(passkey)}
						modifiers={[disabled(model.deleteDisabled)]}
					>
						<DestructiveLabel text="Delete" />
					</Button>
				</Menu>
			</HStack>

			<HStack
				spacing={10}
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				<Label title={details.created} systemImage="calendar" />
				{details.lastUsed ? <Label title={details.lastUsed} systemImage="clock" /> : null}
			</HStack>

			{passkey.cloneWarning ? (
				<Label
					title="Authenticator clone warning"
					systemImage="exclamationmark.triangle.fill"
					modifiers={[
						font({ textStyle: 'caption', weight: 'semibold' }),
						foregroundStyle(systemColors.orange)
					]}
				/>
			) : passkey.backupState ? (
				<Label
					title="Synced passkey"
					systemImage="icloud.and.arrow.up"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				/>
			) : null}
		</VStack>
	);
}

function PasskeysSection({ model }: { model: PasskeysMFAModel }) {
	return (
		<Section title="Passkeys">
			{model.passkeys.length === 0 ? (
				<ContentUnavailableView
					title="No Passkeys"
					systemImage="person.badge.key"
					description={model.emptyDescription}
				/>
			) : (
				model.passkeys.map((passkey) => (
					<PasskeyRow key={passkey.id} passkey={passkey} model={model} />
				))
			)}
		</Section>
	);
}

export function PasskeysMFAScreen() {
	const model = usePasskeysMFA();

	const form = (
		<Form modifiers={[refreshable(model.refresh)]}>
			{model.showsInitialLoading ? (
				<Section>
					<HStack>
						<Spacer />
						<ArcaneLoadingViewSwiftUI label="Loading security settings…" />
						<Spacer />
					</HStack>
				</Section>
			) : (
				<>
					<MFASection model={model} />
					<PasskeysSection model={model} />
				</>
			)}
		</Form>
	);

	return (
		<>
			<Stack.Screen options={{ title: 'Passkeys & MFA', headerLargeTitleEnabled: false }} />
			<AppToolbar>
				<Stack.Toolbar.Button
					icon="plus"
					accessibilityLabel="Add Passkey"
					disabled={model.addDisabled}
					onPress={model.beginAdd}
				/>
			</AppToolbar>
			<Host style={{ flex: 1 }}>
				<Alert
					title="Add Passkey"
					isPresented={model.showsAddPrompt}
					onIsPresentedChange={(presented) => {
						if (!presented) model.dismissAddPrompt();
					}}
				>
					<Alert.Trigger>
						<Alert
							title="Rename Passkey"
							isPresented={model.renamingPasskey !== undefined}
							onIsPresentedChange={(presented) => {
								if (!presented) model.cancelRename();
							}}
						>
							<Alert.Trigger>{form}</Alert.Trigger>
							<Alert.Actions>
								<BoundTextField
									placeholder="Passkey name"
									value={model.renamedPasskeyName}
									onChangeText={model.setRenamedPasskeyName}
								/>
								<Button label="Cancel" role="cancel" onPress={model.cancelRename} />
								<Button
									label="Save"
									onPress={model.confirmRename}
									modifiers={[disabled(model.renameDisabled)]}
								/>
							</Alert.Actions>
						</Alert>
					</Alert.Trigger>
					<Alert.Actions>
						<BoundTextField
							placeholder="Passkey name (optional)"
							value={model.newPasskeyName}
							onChangeText={model.setNewPasskeyName}
						/>
						<Button label="Cancel" role="cancel" onPress={model.dismissAddPrompt} />
						<Button label="Continue" onPress={model.confirmAdd} />
					</Alert.Actions>
					<Alert.Message>
						<Text>Give this passkey a name you will recognize on this device.</Text>
					</Alert.Message>
				</Alert>
				<StepUpSheet
					isPresented={model.showsStepUp}
					allowsPassword={model.stepUpAllowsPassword}
					allowsPasskey={model.stepUpAllowsPasskey}
					authenticateWithPassword={model.authenticateStepUpWithPassword}
					authenticateWithPasskey={model.authenticateStepUpWithPasskey}
					cancel={model.cancelStepUp}
					onDismissed={model.stepUpDismissed}
				/>
			</Host>
		</>
	);
}
