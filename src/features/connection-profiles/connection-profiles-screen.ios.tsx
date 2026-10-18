import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	Form,
	HStack,
	Label,
	List,
	NavigationStack,
	SecureField,
	Section,
	Spacer,
	SwipeActions,
	Text,
	TextField,
	Toolbar,
	ToolbarItem,
	VStack,
	useNativeState,
	type SecureFieldRef,
	type TextFieldRef
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	accessibilityHint,
	accessibilityLabel,
	accessibilityValue,
	autocorrectionDisabled,
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	frame,
	keyboardType,
	lineLimit,
	listRowBackground,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	onSubmit,
	shapes,
	submitLabel,
	textContentType,
	textInputAutocapitalization,
	tint,
	truncationMode,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useEffectEvent, useRef } from 'react';
import { View } from 'react-native';

import type { ConnectionProfile } from '@/core/connection-profiles/connection-profile-sync';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DeleteConfirmationHost } from '@/ui/components/delete-confirmation';
import { DestructiveLabel } from '@/ui/components/labels';
import { AppToolbar } from '@/ui/components/toolbar';
import { ToastHost } from '@/ui/toast';

import {
	connectionProfilesConfirmationHost,
	useConnectionProfileEditor,
	useConnectionProfiles,
	type ConnectionProfilesModel
} from './use-connection-profiles';

export function ConnectionProfilesScreen({ pushed = false }: { pushed?: boolean }) {
	const toolbarAccent = useAppAccentToolbarSymbol();
	const model = useConnectionProfiles({ pushed });
	if (pushed) {
		return (
			<>
				<Stack.Screen options={{ title: 'Connection Profiles', headerLargeTitleEnabled: false }} />
				<AppToolbar>
					<Stack.Toolbar.Button
						icon="plus"
						accessibilityLabel="Add Connection Profile"
						onPress={model.addProfile}
					/>
				</AppToolbar>
				<Host style={{ flex: 1 }}>
					<ProfilesList model={model} />
				</Host>
			</>
		);
	}
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<ProfilesList
							model={model}
							modifiers={[
								navigationTitle('Connection Profiles'),
								navigationBarTitleDisplayMode('inline')
							]}
						/>
						<Toolbar.Content>
							{model.isSelecting ? (
								<ToolbarItem placement="cancellationAction">
									<Button label="Done" onPress={model.done} modifiers={toolbarAccent} />
								</ToolbarItem>
							) : null}
							<ToolbarItem placement="primaryAction">
								<Button
									onPress={model.addProfile}
									modifiers={[...toolbarAccent, accessibilityLabel('Add Connection Profile')]}
								>
									<Image systemName="plus" />
								</Button>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<DeleteConfirmationHost hostID={connectionProfilesConfirmationHost} />
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}

function ProfilesList({
	model,
	modifiers = []
}: {
	model: ConnectionProfilesModel;
	modifiers?: ModifierConfig[];
}) {
	return (
		<List modifiers={[listStyle('insetGrouped'), ...modifiers]}>
			{model.canSaveCurrentServer ? (
				<Section
					footer={
						<Text>Adds the connected server as a profile. Edit it to include a saved sign-in.</Text>
					}
				>
					<Button onPress={model.saveCurrentServer}>
						<Label title="Save Current Server" systemImage="plus.circle.fill" />
					</Button>
				</Section>
			) : null}
			<Section
				header={<Text>Saved Profiles</Text>}
				footer={
					<VStack alignment="leading" spacing={6}>
						<Text>{model.syncStateDescription}</Text>
						<Text>{model.copy.listFooter}</Text>
					</VStack>
				}
			>
				{model.profiles.length === 0 ? (
					<ContentUnavailableView
						title="No Connection Profiles"
						systemImage="server.rack"
						description={model.copy.emptyDescription}
						modifiers={[
							frame({ maxWidth: Infinity, minHeight: 220 }),
							listRowBackground('#00000000')
						]}
					/>
				) : (
					model.profiles.map((profile) => (
						<ProfileRow key={profile.id} model={model} profile={profile} />
					))
				)}
			</Section>
		</List>
	);
}

function ProfileRow({
	model,
	profile
}: {
	model: ConnectionProfilesModel;
	profile: ConnectionProfile;
}) {
	const current = model.isCurrent(profile);
	const row = (
		<Button
			onPress={() => model.select(profile)}
			modifiers={[
				buttonStyle('plain'),
				accessibilityLabel(`${profile.name}, ${profile.serverURL}`),
				accessibilityValue(model.accessibilityValue(profile)),
				accessibilityHint(model.isSelecting ? 'Connects to this server' : 'Switches to this server')
			]}
		>
			<HStack spacing={12} modifiers={[contentShape(shapes.rectangle())]}>
				<Image
					systemName={current ? 'checkmark.circle.fill' : 'server.rack'}
					modifiers={[
						foregroundStyle(current ? systemColors.green : systemColors.teal),
						frame({ width: 28 })
					]}
				/>
				<VStack alignment="leading" spacing={3}>
					<Text modifiers={[foregroundStyle('primary'), lineLimit(1)]}>{profile.name}</Text>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(1),
							truncationMode('middle')
						]}
					>
						{profile.serverURL}
					</Text>
				</VStack>
				<Spacer minLength={8} />
				{model.hasCredential(profile) ? (
					<Image
						systemName="key.fill"
						modifiers={[
							font({ textStyle: 'caption', weight: 'semibold' }),
							foregroundStyle(systemColors.blue),
							accessibilityLabel(model.copy.credentialBadge)
						]}
					/>
				) : null}
				{current ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption', weight: 'semibold' }),
							foregroundStyle(systemColors.green)
						]}
					>
						Current
					</Text>
				) : (
					<Image
						systemName="chevron.right"
						modifiers={[
							font({ textStyle: 'footnote', weight: 'semibold' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
						]}
					/>
				)}
			</HStack>
		</Button>
	);
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Items>
					<Button onPress={() => model.editProfile(profile)}>
						<Label title="Edit Profile" systemImage="pencil" />
					</Button>
					<Button
						role="destructive"
						onPress={() => model.confirmDelete(profile)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete Profile" />
					</Button>
				</ContextMenu.Items>
				<ContextMenu.Trigger>{row}</ContextMenu.Trigger>
			</ContextMenu>
			<SwipeActions.Actions edge="trailing">
				<Button
					role="destructive"
					onPress={() => model.confirmDelete(profile)}
					modifiers={[tint(systemColors.red)]}
				>
					<Label title="Delete" systemImage="trash" />
				</Button>
				<Button onPress={() => model.editProfile(profile)} modifiers={[tint(systemColors.blue)]}>
					<Label title="Edit" systemImage="pencil" />
				</Button>
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function ConnectionProfileEditorScreen() {
	const toolbarAccent = useAppAccentToolbarSymbol();
	const model = useConnectionProfileEditor();
	const nameRef = useRef<TextFieldRef>(null);
	const serverRef = useRef<TextFieldRef>(null);
	const usernameRef = useRef<TextFieldRef>(null);
	const passwordRef = useRef<SecureFieldRef>(null);
	const focusField = useEffectEvent((field: 'server' | 'username' | 'password') => {
		const ref = field === 'server' ? serverRef : field === 'username' ? usernameRef : passwordRef;
		void ref.current?.focus().catch(() => {});
	});

	const { name, serverURL, username, password } = model;
	const nameText = useNativeState(name);
	const serverText = useNativeState(serverURL);
	const usernameText = useNativeState(username);
	const passwordText = useNativeState(password);
	const syncTexts = useEffectEvent(
		(values: { name: string; serverURL: string; username: string; password: string }) => {
			if (nameText.get() !== values.name) nameText.set(values.name);
			if (serverText.get() !== values.serverURL) serverText.set(values.serverURL);
			if (usernameText.get() !== values.username) usernameText.set(values.username);
			if (passwordText.get() !== values.password) passwordText.set(values.password);
		}
	);
	useEffect(() => {
		syncTexts({ name, serverURL, username, password });
	}, [name, serverURL, username, password]);

	const initialFocusField = useEffectEvent(() => model.initialFocus);
	useEffect(() => {
		const field = initialFocusField();
		const timer = setTimeout(
			() => (field === 'name' ? nameRef : serverRef).current?.focus().catch(() => {}),
			350
		);
		return () => clearTimeout(timer);
	}, []);

	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							<Section
								header={<Text>Profile</Text>}
								footer={<Text>{model.copy.serverURLFooter}</Text>}
							>
								<TextField
									ref={nameRef}
									text={nameText}
									placeholder="Home Server"
									onTextChange={model.setName}
									modifiers={[
										accessibilityLabel('Name'),
										submitLabel('next'),
										onSubmit(() => focusField('server'))
									]}
								/>
								<TextField
									ref={serverRef}
									text={serverText}
									placeholder="arcane.example.com"
									onTextChange={model.setServerURL}
									modifiers={[
										accessibilityLabel('Server URL'),
										textInputAutocapitalization('never'),
										autocorrectionDisabled(),
										keyboardType('url'),
										textContentType('URL'),
										submitLabel('next'),
										onSubmit(() => focusField('username'))
									]}
								/>
							</Section>
							<Section
								header={<Text>Sign-In (Optional)</Text>}
								footer={<Text>{model.signInNotice ?? model.copy.signInFooter}</Text>}
							>
								{model.credentialLoadState === 'loading' ? (
									<HStack spacing={10}>
										<ArcaneLoadingViewSwiftUI label="Loading Saved Sign-In" variant="inline" />
									</HStack>
								) : model.credentialLoadState === 'failed' ? (
									<Button label="Retry Loading Sign-In" onPress={model.loadCredential} />
								) : (
									<>
										<TextField
											ref={usernameRef}
											text={usernameText}
											placeholder="Username"
											onTextChange={model.setUsername}
											modifiers={[
												textInputAutocapitalization('never'),
												autocorrectionDisabled(),
												textContentType('username'),
												submitLabel('next'),
												onSubmit(() => focusField('password'))
											]}
										/>
										<SecureField
											ref={passwordRef}
											text={passwordText}
											placeholder="Password"
											onTextChange={model.setPassword}
											modifiers={[
												textContentType('password'),
												submitLabel('done'),
												onSubmit(model.save)
											]}
										/>
										{model.hasExistingCredential ? (
											<Button
												label="Remove Saved Sign-In"
												role="destructive"
												onPress={model.removeSavedSignIn}
											/>
										) : null}
									</>
								)}
							</Section>
							{model.validationMessage ? (
								<Section>
									<Label
										title={model.validationMessage}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(systemColors.red)]}
									/>
								</Section>
							) : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Cancel" onPress={model.cancel} modifiers={toolbarAccent} />
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Save"
									onPress={model.save}
									modifiers={[...toolbarAccent, disabled(!model.canSave)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
