/** Port of `NotificationProviderFormView` (NotificationProviderFormView.swift). */
import {
	Button,
	ConfirmationDialog,
	DisclosureGroup,
	Form,
	Label,
	LabeledContent,
	List,
	Picker,
	SecureField,
	Section,
	Text,
	Toggle,
	useNativeState,
	VStack
} from '@expo/ui/swift-ui';
import { Host } from '@/ui/host';
import {
	autocorrectionDisabled,
	disabled,
	font,
	foregroundStyle,
	keyboardType,
	lineLimit,
	multilineTextAlignment,
	tag,
	textContentType,
	textInputAutocapitalization,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import {
	EmailAuthMode,
	EmailTLSMode,
	type NotificationTestType
} from '@/sdk/models/notification/Notification';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';

import { SettingsSaveBar, SettingsSaveBarSpacer } from '../shared/settings-save-bar';
import { BoundTextField } from '../shared/swiftui-text-field';
import { testTypeDisplayName, type StableStringRow } from './notification-provider-models';
import {
	secretPlaceholder,
	testTypeOptions,
	useNotificationProviderForm,
	type NotificationProviderFormModel
} from './use-notification-provider-form';

const plainInput: ModifierConfig[] = [
	textInputAutocapitalization('never'),
	autocorrectionDisabled()
];
const trailingInput: ModifierConfig[] = [multilineTextAlignment('trailing'), ...plainInput];

type Setter = (text: string) => void;

function TextRow({
	title,
	prompt = 'Optional',
	value,
	onChange
}: {
	title: string;
	prompt?: string;
	value: string;
	onChange: Setter;
}) {
	return (
		<LabeledContent label={title}>
			<BoundTextField
				placeholder={prompt}
				value={value}
				onChangeText={onChange}
				modifiers={trailingInput}
			/>
		</LabeledContent>
	);
}

function BoundSecureField({
	placeholder,
	value,
	onChangeText
}: {
	placeholder: string;
	value: string;
	onChangeText: Setter;
}) {
	const state = useNativeState(value);
	useEffect(() => {
		if (state.value !== value) state.value = value;
	}, [state, value]);
	return (
		<SecureField
			text={state}
			placeholder={placeholder}
			onTextChange={onChangeText}
			modifiers={trailingInput}
		/>
	);
}

function SecureRow({
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
		<LabeledContent label={title}>
			<BoundSecureField
				placeholder={secretPlaceholder(model)}
				value={value}
				onChangeText={onChange}
			/>
		</LabeledContent>
	);
}

function NumberRow({ title, value, onChange }: { title: string; value: string; onChange: Setter }) {
	return (
		<LabeledContent label={title}>
			<BoundTextField
				placeholder="Optional"
				value={value}
				onChangeText={onChange}
				modifiers={[multilineTextAlignment('trailing'), keyboardType('numeric')]}
			/>
		</LabeledContent>
	);
}

function URLRow({ title, value, onChange }: { title: string; value: string; onChange: Setter }) {
	return (
		<LabeledContent label={title}>
			<BoundTextField
				placeholder="https://…"
				value={value}
				onChangeText={onChange}
				modifiers={[...trailingInput, keyboardType('url'), textContentType('URL')]}
			/>
		</LabeledContent>
	);
}

function EmailRow({ title, value, onChange }: { title: string; value: string; onChange: Setter }) {
	return (
		<LabeledContent label={title}>
			<BoundTextField
				placeholder="name@example.com"
				value={value}
				onChangeText={onChange}
				modifiers={[
					...trailingInput,
					keyboardType('email-address'),
					textContentType('emailAddress')
				]}
			/>
		</LabeledContent>
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
		<Picker label={title} selection={selection} onSelectionChange={onChange}>
			{options.map(([label, value]) => (
				<Text key={value} modifiers={[tag(value)]}>
					{label}
				</Text>
			))}
		</Picker>
	);
}

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, index) => String(from + index));

function Advanced({
	model,
	children
}: {
	model: NotificationProviderFormModel;
	children: ReactNode;
}) {
	return (
		<DisclosureGroup
			label="Advanced"
			isExpanded={model.isAdvancedExpanded}
			onIsExpandedChange={model.setIsAdvancedExpanded}
		>
			{children}
		</DisclosureGroup>
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
		<Section
			title={title}
			footer={rows.length > 0 ? <Text>Swipe left on a row to remove it.</Text> : undefined}
		>
			<List.ForEach onDelete={(indices) => model.rows.remove(rowsKey, indices)}>
				{rows.map((row) => (
					<BoundTextField
						key={row.id}
						placeholder={placeholder}
						value={row.value}
						onChangeText={(text) => model.rows.set(rowsKey, row.id, text)}
						modifiers={plainInput}
					/>
				))}
			</List.ForEach>
			<Button label={addTitle} systemImage="plus" onPress={() => model.rows.add(rowsKey)} />
		</Section>
	);
}

function HeaderRows({ model }: { model: NotificationProviderFormModel }) {
	const { headers } = model.state;
	return (
		<Section
			title="Headers"
			footer={headers.length > 0 ? <Text>Swipe left on a header to remove it.</Text> : undefined}
		>
			<List.ForEach onDelete={model.headers.remove}>
				{headers.map((header) => (
					<VStack key={header.id} alignment="leading">
						<BoundTextField
							placeholder="Header Name"
							value={header.name}
							onChangeText={(name) => model.headers.set(header.id, { name })}
							modifiers={plainInput}
						/>
						<BoundTextField
							placeholder="Header Value"
							value={header.value}
							onChangeText={(value) => model.headers.set(header.id, { value })}
							modifiers={plainInput}
						/>
					</VStack>
				))}
			</List.ForEach>
			<Button label="Add Header" systemImage="plus" onPress={model.headers.add} />
		</Section>
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
	) => <Toggle label={title} isOn={state[key]} onIsOnChange={(isOn) => update(key, isOn)} />;

	switch (model.provider) {
		case 'discord':
			return (
				<Section title="Discord">
					<TextRow
						title="Webhook ID"
						prompt="Required"
						value={state.webhookID}
						onChange={set('webhookID')}
					/>
					<SecureRow
						model={model}
						title="Webhook Token"
						value={state.token}
						onChange={set('token')}
					/>
					<Advanced model={model}>
						<TextRow title="Username" value={state.username} onChange={set('username')} />
						<URLRow title="Avatar URL" value={state.avatarURL} onChange={set('avatarURL')} />
					</Advanced>
				</Section>
			);
		case 'email':
			return (
				<>
					<Section title="SMTP Server">
						<TextRow title="Host" prompt="Required" value={state.host} onChange={set('host')} />
						<NumberRow title="Port" value={state.port} onChange={set('port')} />
						<EmailRow
							title="From Address"
							value={state.fromAddress}
							onChange={set('fromAddress')}
						/>
						<Advanced model={model}>
							<TextRow title="Username" value={state.smtpUsername} onChange={set('smtpUsername')} />
							<SecureRow
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
					</Section>
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
					<Section title="Telegram">
						<SecureRow
							model={model}
							title="Bot Token"
							value={state.token}
							onChange={set('token')}
						/>
						<Advanced model={model}>
							<TextRow title="Title" value={state.title} onChange={set('title')} />
							<TextRow title="Parse Mode" value={state.parseMode} onChange={set('parseMode')} />
							{toggle('Link Previews', 'preview')}
							{toggle('Notification Sound', 'notification')}
						</Advanced>
					</Section>
					<ValueRows
						model={model}
						title="Chat IDs"
						rowsKey="recipients"
						rows={state.recipients}
						placeholder="-1001234567890[:topic]"
						addTitle="Add Chat ID"
					/>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						Append :topicID to target a forum topic, e.g. -1001234567890:42.
					</Text>
				</>
			);
		case 'signal':
			return (
				<>
					<Section title="Signal Server">
						<TextRow title="Host" prompt="Required" value={state.host} onChange={set('host')} />
						<NumberRow title="Port" value={state.port} onChange={set('port')} />
						<TextRow
							title="Source"
							prompt="+15551234567"
							value={state.source}
							onChange={set('source')}
						/>
						<Advanced model={model}>
							<TextRow title="User" value={state.user} onChange={set('user')} />
							<SecureRow
								model={model}
								title="Password"
								value={state.password}
								onChange={set('password')}
							/>
							<SecureRow model={model} title="Token" value={state.token} onChange={set('token')} />
							{toggle('Use HTTP', 'disableTLS')}
						</Advanced>
					</Section>
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
				<Section title="Slack">
					<SecureRow model={model} title="Token" value={state.token} onChange={set('token')} />
					<TextRow title="Channel" value={state.channel} onChange={set('channel')} />
					<Advanced model={model}>
						<TextRow title="Bot Name" value={state.botName} onChange={set('botName')} />
						<TextRow title="Icon" value={state.icon} onChange={set('icon')} />
						<TextRow title="Color" value={state.color} onChange={set('color')} />
						<TextRow title="Title" value={state.title} onChange={set('title')} />
						<TextRow title="Thread Timestamp" value={state.threadTS} onChange={set('threadTS')} />
					</Advanced>
				</Section>
			);
		case 'ntfy':
			return (
				<>
					<Section title="Ntfy Server">
						<TextRow title="Host" prompt="ntfy.sh" value={state.host} onChange={set('host')} />
						<TextRow title="Topic" prompt="Required" value={state.topic} onChange={set('topic')} />
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
							<NumberRow title="Port" value={state.port} onChange={set('port')} />
							<TextRow title="Username" value={state.username} onChange={set('username')} />
							<SecureRow
								model={model}
								title="Password"
								value={state.password}
								onChange={set('password')}
							/>
							<TextRow title="Title" value={state.title} onChange={set('title')} />
							<URLRow title="Icon URL" value={state.icon} onChange={set('icon')} />
							{toggle('Cache Messages', 'cache')}
							{toggle('Forward to Firebase', 'firebase')}
							{toggle('Use HTTP', 'disableTLS')}
							{toggle('Skip TLS Verification', 'disableTLSVerification')}
						</Advanced>
					</Section>
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
					<Section title="Pushover">
						<SecureRow
							model={model}
							title="API Token"
							value={state.token}
							onChange={set('token')}
						/>
						<TextRow title="User Key" prompt="Required" value={state.user} onChange={set('user')} />
						<Advanced model={model}>
							<OptionPicker
								title="Priority"
								selection={state.priority}
								onChange={set('priority')}
								options={range(-2, 2).map((value) => [value, value])}
							/>
							<TextRow title="Title" value={state.title} onChange={set('title')} />
						</Advanced>
					</Section>
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
				<Section title="Gotify">
					<TextRow title="Host" prompt="Required" value={state.host} onChange={set('host')} />
					<SecureRow model={model} title="App Token" value={state.token} onChange={set('token')} />
					<OptionPicker
						title="Priority"
						selection={state.priority}
						onChange={set('priority')}
						options={range(-2, 10).map((value) => [value, value])}
					/>
					<Advanced model={model}>
						<NumberRow title="Port" value={state.port} onChange={set('port')} />
						<TextRow title="Path" value={state.path} onChange={set('path')} />
						<TextRow title="Title" value={state.title} onChange={set('title')} />
						{toggle('Use HTTP', 'disableTLS')}
						{toggle('Skip TLS Verification', 'insecureSkipVerify')}
						{toggle('Send Token in Header', 'useHeader')}
					</Advanced>
				</Section>
			);
		case 'matrix':
			return (
				<Section title="Matrix">
					<TextRow title="Host" prompt="Required" value={state.host} onChange={set('host')} />
					<TextRow title="Rooms" prompt="Required" value={state.rooms} onChange={set('rooms')} />
					<Advanced model={model}>
						<NumberRow title="Port" value={state.port} onChange={set('port')} />
						<TextRow title="Username" value={state.username} onChange={set('username')} />
						<SecureRow
							model={model}
							title="Password"
							value={state.password}
							onChange={set('password')}
						/>
						{toggle('Skip TLS Verification', 'disableTLSVerification')}
					</Advanced>
				</Section>
			);
		case 'googlechat':
			return (
				<Section title="Google Chat">
					<URLRow title="Webhook URL" value={state.webhookURL} onChange={set('webhookURL')} />
				</Section>
			);
		case 'generic':
			return (
				<>
					<Section title="Request">
						<URLRow title="Webhook URL" value={state.webhookURL} onChange={set('webhookURL')} />
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
							<TextRow
								title="Content Type"
								value={state.contentType}
								onChange={set('contentType')}
							/>
							{toggle('Use HTTP', 'disableTLS')}
							{model.supportsPost26Features ? (
								<>
									<TextRow title="Title Key" value={state.titleKey} onChange={set('titleKey')} />
									<TextRow
										title="Message Key"
										value={state.messageKey}
										onChange={set('messageKey')}
									/>
									<BoundTextField
										placeholder="JSON payload template"
										value={state.payloadTemplate}
										onChangeText={set('payloadTemplate')}
										axis="vertical"
										modifiers={[...plainInput, lineLimit({ min: 4, max: 10 })]}
									/>
									<TextRow
										title="Expected Response Contains"
										value={state.successBodyContains}
										onChange={set('successBodyContains')}
									/>
								</>
							) : null}
						</Advanced>
					</Section>
					{model.isAdvancedExpanded ? <HeaderRows model={model} /> : null}
				</>
			);
	}
}

function EventSection({ model }: { model: NotificationProviderFormModel }) {
	const { events } = model.state;
	return (
		<Section
			title="Event Subscriptions"
			footer={<Text>Choose which events trigger notifications for this provider.</Text>}
		>
			<Toggle
				label="Image Updates"
				isOn={events.imageUpdate}
				onIsOnChange={(isOn) => model.updateEvent('imageUpdate', isOn)}
			/>
			<Toggle
				label="Container Updates"
				isOn={events.containerUpdate}
				onIsOnChange={(isOn) => model.updateEvent('containerUpdate', isOn)}
			/>
			<Toggle
				label="Vulnerabilities"
				isOn={events.vulnerabilityFound}
				onIsOnChange={(isOn) => model.updateEvent('vulnerabilityFound', isOn)}
			/>
			<Toggle
				label="Prune Reports"
				isOn={events.pruneReport}
				onIsOnChange={(isOn) => model.updateEvent('pruneReport', isOn)}
			/>
			<Toggle
				label="Auto-Heal"
				isOn={events.autoHeal}
				onIsOnChange={(isOn) => model.updateEvent('autoHeal', isOn)}
			/>
		</Section>
	);
}

export function NotificationProviderFormScreen() {
	const model = useNotificationProviderForm();
	const { state } = model;
	return (
		<View style={{ flex: 1 }}>
			<Stack.Screen
				options={{
					title: model.title,
					headerLargeTitleEnabled: false,
					headerTransparent: false
				}}
			/>
			<Host style={{ flex: 1 }}>
				<Form>
					<Section title="Status">
						<Toggle
							label="Enabled"
							isOn={state.enabled}
							onIsOnChange={(isOn) => model.update('enabled', isOn)}
						/>
					</Section>

					{state.enabled ? (
						<>
							<ConfigurationSections model={model} />
							<EventSection model={model} />
						</>
					) : null}

					{model.errorMessage ? (
						<Section>
							<Label
								title={model.errorMessage}
								systemImage="exclamationmark.triangle"
								modifiers={[foregroundStyle(systemColors.red)]}
							/>
						</Section>
					) : null}

					<Section title="Actions">
						{state.enabled ? (
							<Picker
								label="Test Type"
								selection={model.selectedTestType}
								onSelectionChange={(value: NotificationTestType) =>
									model.setSelectedTestType(value)
								}
							>
								{testTypeOptions.map((type) => (
									<Text key={type} modifiers={[tag(type)]}>
										{testTypeDisplayName[type]}
									</Text>
								))}
							</Picker>
						) : null}
						{state.enabled ? (
							<ConfirmationDialog
								title="Save Changes Before Testing?"
								isPresented={model.showsSaveBeforeTestConfirmation}
								onIsPresentedChange={model.setShowsSaveBeforeTestConfirmation}
								titleVisibility="visible"
							>
								<ConfirmationDialog.Trigger>
									<Button
										label="Send Test Notification"
										systemImage="paperplane"
										onPress={model.sendTest}
										modifiers={[disabled(model.isSaving || model.isTesting || !model.isValid)]}
									/>
								</ConfirmationDialog.Trigger>
								<ConfirmationDialog.Actions>
									<Button
										label="Save and Send Test"
										onPress={() => void model.testNotification()}
									/>
									<Button label="Cancel" role="cancel" />
								</ConfirmationDialog.Actions>
								<ConfirmationDialog.Message>
									<Text>
										The provider must be saved before Arcane can test the updated configuration.
									</Text>
								</ConfirmationDialog.Message>
							</ConfirmationDialog>
						) : null}
						{model.isTesting ? (
							<ArcaneLoadingViewSwiftUI label="Sending test…" variant="inline" />
						) : null}
					</Section>
					<SettingsSaveBarSpacer />
				</Form>
			</Host>
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
