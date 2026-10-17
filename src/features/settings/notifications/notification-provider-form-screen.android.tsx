/** Android rendering of `NotificationProviderFormView` (NotificationProviderFormView.swift). */
import { Stack } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmailAuthMode, EmailTLSMode } from '@/sdk/models/notification/Notification';
import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormPicker, FormSecureField, FormTextField } from '@/ui/components/form-fields';
import type { FormKeyboardType, FormTextFieldProps } from '@/ui/components/form-fields.types';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { ErrorSection } from '../shared/android-error-section';
import { M3Section, SwitchRow, TextButtonRow } from '../shared/android-material';
import { SettingsSaveBar, settingsSaveBarHeight } from '../shared/settings-save-bar';
import { testTypeDisplayName, type StableStringRow } from './notification-provider-models';
import {
	secretPlaceholder,
	testTypeOptions,
	useNotificationProviderForm,
	type NotificationProviderFormModel
} from './use-notification-provider-form';

type Setter = (text: string) => void;

function Field({
	title,
	prompt = 'Optional',
	value,
	onChange,
	keyboardType,
	textContentType
}: {
	title: string;
	prompt?: string;
	value: string;
	onChange: Setter;
	keyboardType?: FormKeyboardType;
	textContentType?: FormTextFieldProps['textContentType'];
}) {
	return (
		<FormTextField
			title={title}
			placeholder={prompt}
			text={value}
			onChangeText={onChange}
			keyboardType={keyboardType}
			textContentType={textContentType}
			autocapitalization="never"
			autocorrectionDisabled
			layout="inline"
		/>
	);
}

const NumberField = (props: { title: string; value: string; onChange: Setter }) => (
	<Field {...props} keyboardType="numeric" />
);
const URLField = (props: { title: string; value: string; onChange: Setter }) => (
	<Field {...props} prompt="https://…" keyboardType="url" textContentType="URL" />
);
const EmailField = (props: { title: string; value: string; onChange: Setter }) => (
	<Field
		{...props}
		prompt="name@example.com"
		keyboardType="email-address"
		textContentType="emailAddress"
	/>
);

function SecretField({
	model,
	title,
	value,
	onChange
}: {
	model: NotificationProviderFormModel;
	title: string;
	value: string;
	onChange: Setter;
}) {
	return (
		<FormSecureField
			title={title}
			placeholder={secretPlaceholder(model)}
			text={value}
			onChangeText={onChange}
		/>
	);
}

function OptionPicker({
	title,
	selection,
	onChange,
	options
}: {
	title: string;
	selection: string;
	onChange: Setter;
	options: [string, string][];
}) {
	return (
		<FormPicker
			title={title}
			selection={selection}
			onSelectionChange={onChange}
			options={options.map(([label, value]) => ({ label, value }))}
		/>
	);
}

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, index) => String(from + index));

/** `DisclosureGroup("Advanced")`. */
function Advanced({
	model,
	children
}: {
	model: NotificationProviderFormModel;
	children: ReactNode;
}) {
	const expanded = model.isAdvancedExpanded;
	return (
		<>
			<Pressable
				onPress={() => model.setIsAdvancedExpanded(!expanded)}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				android_ripple={{ color: colors.separator as string }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					minHeight: 56,
					paddingHorizontal: 16
				}}
			>
				<Text style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}>Advanced</Text>
				<Icon
					name={expanded ? 'chevron.up' : 'chevron.down'}
					size={20}
					color={colors.secondaryLabel}
				/>
			</Pressable>
			{expanded ? children : null}
		</>
	);
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{
				color: colors.separator as string,
				borderless: true,
				radius: 20
			}}
			style={{
				width: 40,
				height: 40,
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<Icon name="minus.circle.fill" size={22} color={m3.error} />
		</Pressable>
	);
}

function RowInput({
	placeholder,
	value,
	onChange
}: {
	placeholder: string;
	value: string;
	onChange: Setter;
}) {
	return (
		<TextInput
			value={value}
			onChangeText={onChange}
			placeholder={placeholder}
			placeholderTextColor={colors.tertiaryLabel as string}
			autoCapitalize="none"
			autoCorrect={false}
			accessibilityLabel={placeholder}
			style={[m3Type.bodyLarge, { flex: 1, color: colors.label, minHeight: 48 }]}
		/>
	);
}

function ValueRows({
	model,
	title,
	rowsKey,
	rows,
	placeholder,
	addTitle
}: {
	model: NotificationProviderFormModel;
	title: string;
	rowsKey: 'recipients' | 'tags' | 'devices';
	rows: StableStringRow[];
	placeholder: string;
	addTitle: string;
}) {
	return (
		<M3Section title={title}>
			{rows.map((row, index) => (
				<View
					key={row.id}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						paddingLeft: 16,
						paddingRight: 8
					}}
				>
					<RowInput
						placeholder={placeholder}
						value={row.value}
						onChange={(text) => model.rows.set(rowsKey, row.id, text)}
					/>
					<RemoveButton label="Remove" onPress={() => model.rows.remove(rowsKey, [index])} />
				</View>
			))}
			<TextButtonRow title={addTitle} onPress={() => model.rows.add(rowsKey)} />
		</M3Section>
	);
}

function HeaderRows({ model }: { model: NotificationProviderFormModel }) {
	return (
		<M3Section title="Headers">
			{model.state.headers.map((header, index) => (
				<View
					key={header.id}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						paddingLeft: 16,
						paddingRight: 8
					}}
				>
					<View style={{ flex: 1 }}>
						<RowInput
							placeholder="Header Name"
							value={header.name}
							onChange={(name) => model.headers.set(header.id, { name })}
						/>
						<RowInput
							placeholder="Header Value"
							value={header.value}
							onChange={(value) => model.headers.set(header.id, { value })}
						/>
					</View>
					<RemoveButton label="Remove header" onPress={() => model.headers.remove([index])} />
				</View>
			))}
			<TextButtonRow title="Add Header" onPress={model.headers.add} />
		</M3Section>
	);
}

function ConfigurationSections({ model }: { model: NotificationProviderFormModel }) {
	const { state, update } = model;
	const set = (key: Parameters<typeof update>[0]) => (text: string) => update(key, text);
	const toggle = (
		title: string,
		key:
			| 'disableTLS'
			| 'disableTLSVerification'
			| 'preview'
			| 'notification'
			| 'cache'
			| 'firebase'
			| 'insecureSkipVerify'
			| 'useHeader'
	) => <SwitchRow title={title} value={state[key]} onValueChange={(isOn) => update(key, isOn)} />;

	switch (model.provider) {
		case 'discord':
			return (
				<M3Section title="Discord">
					<Field
						title="Webhook ID"
						prompt="Required"
						value={state.webhookID}
						onChange={set('webhookID')}
					/>
					<SecretField
						model={model}
						title="Webhook Token"
						value={state.token}
						onChange={set('token')}
					/>
					<Advanced model={model}>
						<Field title="Username" value={state.username} onChange={set('username')} />
						<URLField title="Avatar URL" value={state.avatarURL} onChange={set('avatarURL')} />
					</Advanced>
				</M3Section>
			);
		case 'email':
			return (
				<>
					<M3Section title="SMTP Server">
						<Field title="Host" prompt="Required" value={state.host} onChange={set('host')} />
						<NumberField title="Port" value={state.port} onChange={set('port')} />
						<EmailField
							title="From Address"
							value={state.fromAddress}
							onChange={set('fromAddress')}
						/>
						<Advanced model={model}>
							<Field title="Username" value={state.smtpUsername} onChange={set('smtpUsername')} />
							<SecretField
								model={model}
								title="Password"
								value={state.password}
								onChange={set('password')}
							/>
							<OptionPicker
								title="TLS"
								selection={state.tlsMode}
								onChange={set('tlsMode')}
								options={[
									['None', EmailTLSMode.none],
									['StartTLS', EmailTLSMode.starttls],
									['SSL/TLS', EmailTLSMode.ssl]
								]}
							/>
							<OptionPicker
								title="Authentication"
								selection={state.authMode}
								onChange={set('authMode')}
								options={[
									['Auto', EmailAuthMode.auto],
									['None', EmailAuthMode.none],
									['PLAIN', EmailAuthMode.plain],
									['LOGIN', EmailAuthMode.login],
									['CRAM-MD5', EmailAuthMode.crammd5]
								]}
							/>
						</Advanced>
					</M3Section>
					<ValueRows
						model={model}
						title="Recipients"
						rowsKey="recipients"
						rows={state.recipients}
						placeholder="alerts@example.com"
						addTitle="Add Recipient"
					/>
				</>
			);
		case 'telegram':
			return (
				<>
					<M3Section title="Telegram">
						<SecretField
							model={model}
							title="Bot Token"
							value={state.token}
							onChange={set('token')}
						/>
						<Advanced model={model}>
							<Field title="Title" value={state.title} onChange={set('title')} />
							<Field title="Parse Mode" value={state.parseMode} onChange={set('parseMode')} />
							{toggle('Link Previews', 'preview')}
							{toggle('Notification Sound', 'notification')}
						</Advanced>
					</M3Section>
					<ValueRows
						model={model}
						title="Chat IDs"
						rowsKey="recipients"
						rows={state.recipients}
						placeholder="-1001234567890[:topic]"
						addTitle="Add Chat ID"
					/>
					<Text
						style={[
							m3Type.bodySmall,
							{
								color: colors.secondaryLabel,
								paddingHorizontal: 32,
								paddingTop: 8
							}
						]}
					>
						Append :topicID to target a forum topic, e.g. -1001234567890:42.
					</Text>
				</>
			);
		case 'signal':
			return (
				<>
					<M3Section title="Signal Server">
						<Field title="Host" prompt="Required" value={state.host} onChange={set('host')} />
						<NumberField title="Port" value={state.port} onChange={set('port')} />
						<Field
							title="Source"
							prompt="+15551234567"
							value={state.source}
							onChange={set('source')}
						/>
						<Advanced model={model}>
							<Field title="User" value={state.user} onChange={set('user')} />
							<SecretField
								model={model}
								title="Password"
								value={state.password}
								onChange={set('password')}
							/>
							<SecretField
								model={model}
								title="Token"
								value={state.token}
								onChange={set('token')}
							/>
							{toggle('Use HTTP', 'disableTLS')}
						</Advanced>
					</M3Section>
					<ValueRows
						model={model}
						title="Recipients"
						rowsKey="recipients"
						rows={state.recipients}
						placeholder="+15551234567"
						addTitle="Add Recipient"
					/>
				</>
			);
		case 'slack':
			return (
				<M3Section title="Slack">
					<SecretField model={model} title="Token" value={state.token} onChange={set('token')} />
					<Field title="Channel" value={state.channel} onChange={set('channel')} />
					<Advanced model={model}>
						<Field title="Bot Name" value={state.botName} onChange={set('botName')} />
						<Field title="Icon" value={state.icon} onChange={set('icon')} />
						<Field title="Color" value={state.color} onChange={set('color')} />
						<Field title="Title" value={state.title} onChange={set('title')} />
						<Field title="Thread Timestamp" value={state.threadTS} onChange={set('threadTS')} />
					</Advanced>
				</M3Section>
			);
		case 'ntfy':
			return (
				<>
					<M3Section title="Ntfy Server">
						<Field title="Host" prompt="ntfy.sh" value={state.host} onChange={set('host')} />
						<Field title="Topic" prompt="Required" value={state.topic} onChange={set('topic')} />
						<OptionPicker
							title="Priority"
							selection={state.priority}
							onChange={set('priority')}
							options={[
								['Min (1)', 'min'],
								['Low (2)', 'low'],
								['Default (3)', 'default'],
								['High (4)', 'high'],
								['Max/Urgent (5)', 'max']
							]}
						/>
						<Advanced model={model}>
							<NumberField title="Port" value={state.port} onChange={set('port')} />
							<Field title="Username" value={state.username} onChange={set('username')} />
							<SecretField
								model={model}
								title="Password"
								value={state.password}
								onChange={set('password')}
							/>
							<Field title="Title" value={state.title} onChange={set('title')} />
							<URLField title="Icon URL" value={state.icon} onChange={set('icon')} />
							{toggle('Cache Messages', 'cache')}
							{toggle('Forward to Firebase', 'firebase')}
							{toggle('Use HTTP', 'disableTLS')}
							{toggle('Skip TLS Verification', 'disableTLSVerification')}
						</Advanced>
					</M3Section>
					<ValueRows
						model={model}
						title="Tags"
						rowsKey="tags"
						rows={state.tags}
						placeholder="warning"
						addTitle="Add Tag"
					/>
				</>
			);
		case 'pushover':
			return (
				<>
					<M3Section title="Pushover">
						<SecretField
							model={model}
							title="API Token"
							value={state.token}
							onChange={set('token')}
						/>
						<Field title="User Key" prompt="Required" value={state.user} onChange={set('user')} />
						<Advanced model={model}>
							<OptionPicker
								title="Priority"
								selection={state.priority}
								onChange={set('priority')}
								options={range(-2, 2).map((value) => [value, value])}
							/>
							<Field title="Title" value={state.title} onChange={set('title')} />
						</Advanced>
					</M3Section>
					<ValueRows
						model={model}
						title="Devices"
						rowsKey="devices"
						rows={state.devices}
						placeholder="iphone"
						addTitle="Add Device"
					/>
				</>
			);
		case 'gotify':
			return (
				<M3Section title="Gotify">
					<Field title="Host" prompt="Required" value={state.host} onChange={set('host')} />
					<SecretField
						model={model}
						title="App Token"
						value={state.token}
						onChange={set('token')}
					/>
					<OptionPicker
						title="Priority"
						selection={state.priority}
						onChange={set('priority')}
						options={range(-2, 10).map((value) => [value, value])}
					/>
					<Advanced model={model}>
						<NumberField title="Port" value={state.port} onChange={set('port')} />
						<Field title="Path" value={state.path} onChange={set('path')} />
						<Field title="Title" value={state.title} onChange={set('title')} />
						{toggle('Use HTTP', 'disableTLS')}
						{toggle('Skip TLS Verification', 'insecureSkipVerify')}
						{toggle('Send Token in Header', 'useHeader')}
					</Advanced>
				</M3Section>
			);
		case 'matrix':
			return (
				<M3Section title="Matrix">
					<Field title="Host" prompt="Required" value={state.host} onChange={set('host')} />
					<Field title="Rooms" prompt="Required" value={state.rooms} onChange={set('rooms')} />
					<Advanced model={model}>
						<NumberField title="Port" value={state.port} onChange={set('port')} />
						<Field title="Username" value={state.username} onChange={set('username')} />
						<SecretField
							model={model}
							title="Password"
							value={state.password}
							onChange={set('password')}
						/>
						{toggle('Skip TLS Verification', 'disableTLSVerification')}
					</Advanced>
				</M3Section>
			);
		case 'googlechat':
			return (
				<M3Section title="Google Chat">
					<URLField title="Webhook URL" value={state.webhookURL} onChange={set('webhookURL')} />
				</M3Section>
			);
		case 'generic':
			return (
				<>
					<M3Section title="Request">
						<URLField title="Webhook URL" value={state.webhookURL} onChange={set('webhookURL')} />
						<OptionPicker
							title="Method"
							selection={state.method}
							onChange={set('method')}
							options={[
								['POST', 'POST'],
								['PUT', 'PUT'],
								['PATCH', 'PATCH']
							]}
						/>
						<Advanced model={model}>
							<Field title="Content Type" value={state.contentType} onChange={set('contentType')} />
							{toggle('Use HTTP', 'disableTLS')}
							{model.supportsPost26Features ? (
								<>
									<Field title="Title Key" value={state.titleKey} onChange={set('titleKey')} />
									<Field
										title="Message Key"
										value={state.messageKey}
										onChange={set('messageKey')}
									/>
									<FormTextField
										title="Payload Template"
										placeholder="JSON payload template"
										text={state.payloadTemplate}
										onChangeText={set('payloadTemplate')}
										autocapitalization="never"
										autocorrectionDisabled
										axis="vertical"
										lineLimit={{ min: 4, max: 10 }}
										layout="stacked"
									/>
									<Field
										title="Expected Response Contains"
										value={state.successBodyContains}
										onChange={set('successBodyContains')}
									/>
								</>
							) : null}
						</Advanced>
					</M3Section>
					{model.isAdvancedExpanded ? <HeaderRows model={model} /> : null}
				</>
			);
	}
}

function EventSection({ model }: { model: NotificationProviderFormModel }) {
	const { events } = model.state;
	return (
		<M3Section
			title="Event Subscriptions"
			footer="Choose which events trigger notifications for this provider."
		>
			<SwitchRow
				title="Image Updates"
				value={events.imageUpdate}
				onValueChange={(isOn) => model.updateEvent('imageUpdate', isOn)}
			/>
			<SwitchRow
				title="Container Updates"
				value={events.containerUpdate}
				onValueChange={(isOn) => model.updateEvent('containerUpdate', isOn)}
			/>
			<SwitchRow
				title="Vulnerabilities"
				value={events.vulnerabilityFound}
				onValueChange={(isOn) => model.updateEvent('vulnerabilityFound', isOn)}
			/>
			<SwitchRow
				title="Prune Reports"
				value={events.pruneReport}
				onValueChange={(isOn) => model.updateEvent('pruneReport', isOn)}
			/>
			<SwitchRow
				title="Auto-Heal"
				value={events.autoHeal}
				onValueChange={(isOn) => model.updateEvent('autoHeal', isOn)}
			/>
		</M3Section>
	);
}

/** `.confirmationDialog("Save Changes Before Testing?")` as a Material dialog. */
function useSaveBeforeTestDialog(model: NotificationProviderFormModel) {
	const latest = useRef(model);
	latest.current = model;
	const isPresented = model.showsSaveBeforeTestConfirmation;
	useEffect(() => {
		if (!isPresented) return;
		const close = () => latest.current.setShowsSaveBeforeTestConfirmation(false);
		Alert.alert(
			'Save Changes Before Testing?',
			'The provider must be saved before Arcane can test the updated configuration.',
			[
				{ text: 'Cancel', style: 'cancel', onPress: close },
				{
					text: 'Save and Send Test',
					onPress: () => {
						close();
						void latest.current.testNotification();
					}
				}
			],
			{ cancelable: true, onDismiss: close }
		);
	}, [isPresented]);
}

export function NotificationProviderFormScreen() {
	const model = useNotificationProviderForm();
	const { state } = model;
	useSaveBeforeTestDialog(model);
	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Stack.Screen options={{ title: model.title }} />
			<ScrollView
				contentContainerStyle={{ paddingBottom: settingsSaveBarHeight + 24 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Status">
					<SwitchRow
						title="Enabled"
						value={state.enabled}
						onValueChange={(isOn) => model.update('enabled', isOn)}
					/>
				</M3Section>

				{state.enabled ? (
					<>
						<ConfigurationSections model={model} />
						<EventSection model={model} />
					</>
				) : null}

				{model.errorMessage ? <ErrorSection message={model.errorMessage} /> : null}

				{state.enabled || model.isTesting ? (
					<M3Section title="Actions">
						{state.enabled ? (
							<FormPicker
								title="Test Type"
								selection={model.selectedTestType}
								onSelectionChange={model.setSelectedTestType}
								options={testTypeOptions.map((type) => ({
									label: testTypeDisplayName[type],
									value: type
								}))}
							/>
						) : null}
						{state.enabled ? (
							<TextButtonRow
								title="Send Test Notification"
								onPress={model.sendTest}
								disabled={model.isSaving || model.isTesting || !model.isValid}
							/>
						) : null}
						{model.isTesting ? (
							<View style={{ padding: 16 }}>
								<ArcaneLoadingView label="Sending test…" variant="inline" />
							</View>
						) : null}
					</M3Section>
				) : null}
			</ScrollView>
			<SettingsSaveBar
				hasChanges={model.hasChanges}
				isSaving={model.isSaving}
				canSave={model.isValid}
				isInteractionDisabled={model.isTesting}
				saveAccessibilityLabel={model.isNew ? 'Save' : 'Update'}
				onSave={model.saveAndDismiss}
				onRevert={model.revertChanges}
			/>
		</View>
	);
}
