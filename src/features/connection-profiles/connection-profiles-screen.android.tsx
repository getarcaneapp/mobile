/**
 * Android rendering of `ConnectionProfilesView` / `ConnectionProfileEditorView`
 * (Views/Settings/ConnectionProfilesView.swift) in Material 3. Swipe actions
 * and the context menu become a long-press menu.
 */
import { Stack } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
	Alert,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
	type TextInputInstance,
	type TextInputProps
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ConnectionProfile } from '@/core/connection-profiles/connection-profile-sync';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import { AndroidToolbar } from '@/features/settings/shared/android-toolbar';

import {
	useConnectionProfileEditor,
	useConnectionProfiles,
	type ConnectionProfilesModel
} from './use-connection-profiles';

function SheetBar({
	title,
	leading,
	trailing
}: {
	title: string;
	leading?: ReactNode;
	trailing?: ReactNode;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				minHeight: 64,
				paddingHorizontal: 4,
				gap: 4
			}}
		>
			<View style={{ minWidth: 48 }}>{leading}</View>
			<Text
				style={[m3Type.titleLarge, { flex: 1, color: colors.label }]}
				numberOfLines={1}
				accessibilityRole="header"
			>
				{title}
			</Text>
			<View style={{ minWidth: 48, alignItems: 'flex-end' }}>{trailing}</View>
		</View>
	);
}

function BarTextButton({
	title,
	onPress,
	disabled
}: {
	title: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			android_ripple={{ color: withOpacity(m3.primary as string, 0.12), borderless: true }}
			style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}
		>
			<Text
				style={[
					m3Type.labelLarge,
					{ color: disabled ? withOpacity(colors.label as string, 0.38) : m3.primary }
				]}
			>
				{title}
			</Text>
		</Pressable>
	);
}

function IconButton({
	name,
	label,
	onPress
}: {
	name: string;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{
				color: withOpacity(m3.onSurfaceVariant as string, 0.16),
				borderless: true,
				radius: 24
			}}
			style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
		>
			<Icon name={name} size={24} color={m3.onSurfaceVariant} />
		</Pressable>
	);
}

function Footer({ children }: { children: ReactNode }) {
	return <View style={{ paddingHorizontal: 32, paddingTop: 8, gap: 6 }}>{children}</View>;
}

// Read per render: colors follow the current appearance.
const footerText = () => [m3Type.bodySmall, { color: colors.secondaryLabel }];

/**
 * `pushed`: Account → Connection Profiles in the tab's own stack, under its
 * top app bar. Otherwise the login sheet, which draws its own bar.
 */
export function ConnectionProfilesScreen({ pushed = false }: { pushed?: boolean }) {
	const model = useConnectionProfiles({ pushed });
	if (pushed) {
		return (
			<>
				<Stack.Screen options={{ title: 'Connection Profiles' }} />
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'add',
							icon: 'plus',
							label: 'Add Connection Profile',
							onPress: model.addProfile
						}
					]}
				/>
				<ScrollView
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingBottom: 24 }}
				>
					<ProfilesContent model={model} />
				</ScrollView>
			</>
		);
	}
	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			edges={['bottom']}
		>
			<Stack.Screen options={{ headerShown: false }} />
			<SheetBar
				title="Connection Profiles"
				leading={model.isSelecting ? <BarTextButton title="Done" onPress={model.done} /> : null}
				trailing={
					<IconButton name="plus" label="Add Connection Profile" onPress={model.addProfile} />
				}
			/>
			<ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
				<ProfilesContent model={model} />
			</ScrollView>
		</SafeAreaView>
	);
}

function ProfilesContent({ model }: { model: ConnectionProfilesModel }) {
	return (
		<>
			{model.canSaveCurrentServer ? (
				<>
					<View style={{ height: 8 }} />
					<MaterialListGroup>
						<Row
							icon="plus.circle.fill"
							iconColor={m3.primary as string}
							title="Save Current Server"
							onPress={model.saveCurrentServer}
						/>
					</MaterialListGroup>
					<Footer>
						<Text style={footerText()}>
							Adds the connected server as a profile. Edit it to include a saved sign-in.
						</Text>
					</Footer>
				</>
			) : null}
			<MaterialSectionHeader title="Saved Profiles" />
			{model.profiles.length === 0 ? (
				<View
					style={{
						alignItems: 'center',
						justifyContent: 'center',
						minHeight: 220,
						gap: 8,
						paddingHorizontal: 32
					}}
				>
					<Icon name="server.rack" size={40} color={m3.onSurfaceVariant} />
					<Text style={[m3Type.titleMedium, { color: colors.label }]}>No Connection Profiles</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
						{model.copy.emptyDescription}
					</Text>
				</View>
			) : (
				<MaterialListGroup>
					{model.profiles.map((profile) => (
						<ProfileRow key={profile.id} model={model} profile={profile} />
					))}
				</MaterialListGroup>
			)}
			<Footer>
				<Text style={footerText()}>{model.syncStateDescription}</Text>
				<Text style={footerText()}>{model.copy.listFooter}</Text>
			</Footer>
		</>
	);
}

function Row({
	icon,
	iconColor,
	title,
	subtitle,
	trailing,
	onPress,
	onLongPress,
	accessibilityLabel,
	accessibilityHint
}: {
	icon: string;
	iconColor: string;
	title: string;
	subtitle?: string;
	trailing?: ReactNode;
	onPress: () => void;
	onLongPress?: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			android_ripple={{ color: withOpacity(m3.onSurfaceVariant as string, 0.12) }}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: subtitle ? 72 : 56,
				paddingHorizontal: 16
			}}
		>
			<Icon name={icon} size={24} color={iconColor} />
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]} numberOfLines={1}>
					{title}
				</Text>
				{subtitle ? (
					<Text
						style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}
						numberOfLines={1}
						ellipsizeMode="middle"
					>
						{subtitle}
					</Text>
				) : null}
			</View>
			{trailing}
		</Pressable>
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
	// SwiftUI's context menu / swipe actions → a long-press menu.
	const showMenu = () =>
		Alert.alert(profile.name, profile.serverURL, [
			{ text: 'Edit Profile', onPress: () => model.editProfile(profile) },
			{ text: 'Delete Profile', style: 'destructive', onPress: () => model.confirmDelete(profile) },
			{ text: 'Cancel', style: 'cancel' }
		]);
	return (
		<Row
			icon={current ? 'checkmark.circle.fill' : 'server.rack'}
			iconColor={current ? systemColors.green : systemColors.teal}
			title={profile.name}
			subtitle={profile.serverURL}
			onPress={() => model.select(profile)}
			onLongPress={showMenu}
			accessibilityLabel={`${profile.name}, ${profile.serverURL}${model.accessibilityValue(profile) ? `, ${model.accessibilityValue(profile)}` : ''}`}
			accessibilityHint={model.isSelecting ? 'Connects to this server' : 'Switches to this server'}
			trailing={
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					{model.hasCredential(profile) ? (
						<Icon name="key.fill" size={16} color={systemColors.blue} />
					) : null}
					{current ? (
						<Text style={[m3Type.labelMedium, { color: systemColors.green }]}>Current</Text>
					) : (
						<Icon name="chevron.right" size={18} color={m3.onSurfaceVariant} />
					)}
				</View>
			}
		/>
	);
}

// MARK: - Editor

function OutlinedField({
	label,
	inputRef,
	...input
}: TextInputProps & { label: string; inputRef?: React.RefObject<TextInputInstance | null> }) {
	const [focused, setFocused] = useState(false);
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 6, gap: 4 }}>
			<Text style={[m3Type.labelMedium, { color: focused ? m3.primary : colors.secondaryLabel }]}>
				{label}
			</Text>
			<TextInput
				ref={inputRef}
				accessibilityLabel={label}
				placeholderTextColor={colors.tertiaryLabel as string}
				cursorColor={m3.primary as string}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				style={[
					m3Type.bodyLarge,
					{
						color: colors.label,
						borderWidth: focused ? 2 : 1,
						borderColor: focused ? m3.primary : m3.outline,
						borderRadius: 4,
						paddingHorizontal: 16,
						minHeight: 56
					}
				]}
				{...input}
			/>
		</View>
	);
}

export function ConnectionProfileEditorScreen() {
	const model = useConnectionProfileEditor();
	const nameRef = useRef<TextInputInstance>(null);
	const serverRef = useRef<TextInputInstance>(null);
	const usernameRef = useRef<TextInputInstance>(null);
	const passwordRef = useRef<TextInputInstance>(null);

	useEffect(() => {
		const timer = setTimeout(
			() => (model.initialFocus === 'name' ? nameRef : serverRef).current?.focus(),
			350
		);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			edges={['bottom']}
		>
			<Stack.Screen options={{ headerShown: false }} />
			<SheetBar
				title={model.title}
				leading={<BarTextButton title="Cancel" onPress={model.cancel} />}
				trailing={<BarTextButton title="Save" onPress={model.save} disabled={!model.canSave} />}
			/>
			<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
				<MaterialSectionHeader title="Profile" />
				<MaterialListGroup>
					<View style={{ paddingVertical: 8 }}>
						<OutlinedField
							inputRef={nameRef}
							label="Name"
							placeholder="Home Server"
							value={model.name}
							onChangeText={model.setName}
							returnKeyType="next"
							submitBehavior="submit"
							onSubmitEditing={() => serverRef.current?.focus()}
						/>
						<OutlinedField
							inputRef={serverRef}
							label="Server URL"
							placeholder="arcane.example.com"
							value={model.serverURL}
							onChangeText={model.setServerURL}
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="url"
							autoComplete="url"
							returnKeyType="next"
							submitBehavior="submit"
							onSubmitEditing={() => usernameRef.current?.focus()}
						/>
					</View>
				</MaterialListGroup>
				<Footer>
					<Text style={footerText()}>{model.copy.serverURLFooter}</Text>
				</Footer>

				<MaterialSectionHeader title="Sign-In (Optional)" />
				<MaterialListGroup>
					{model.credentialLoadState === 'loading' ? (
						<View style={{ padding: 16 }}>
							<ArcaneLoadingView label="Loading Saved Sign-In" variant="inline" />
						</View>
					) : model.credentialLoadState === 'failed' ? (
						<Row
							icon="arrow.clockwise"
							iconColor={m3.primary as string}
							title="Retry Loading Sign-In"
							onPress={model.loadCredential}
						/>
					) : (
						<View style={{ paddingVertical: 8 }}>
							<OutlinedField
								inputRef={usernameRef}
								label="Username"
								value={model.username}
								onChangeText={model.setUsername}
								autoCapitalize="none"
								autoCorrect={false}
								autoComplete="username"
								returnKeyType="next"
								submitBehavior="submit"
								onSubmitEditing={() => passwordRef.current?.focus()}
							/>
							<OutlinedField
								inputRef={passwordRef}
								label="Password"
								value={model.password}
								onChangeText={model.setPassword}
								secureTextEntry
								autoComplete="current-password"
								returnKeyType="done"
								onSubmitEditing={model.save}
							/>
							{model.hasExistingCredential ? (
								<Pressable
									onPress={model.removeSavedSignIn}
									accessibilityRole="button"
									android_ripple={{ color: withOpacity(m3.error as string, 0.12) }}
									style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' }}
								>
									<Text style={[m3Type.labelLarge, { color: m3.error }]}>Remove Saved Sign-In</Text>
								</Pressable>
							) : null}
						</View>
					)}
				</MaterialListGroup>
				<Footer>
					<Text style={footerText()}>{model.signInNotice ?? model.copy.signInFooter}</Text>
				</Footer>

				{model.validationMessage ? (
					<View
						style={{
							flexDirection: 'row',
							gap: 8,
							alignItems: 'center',
							paddingHorizontal: 32,
							paddingTop: 16
						}}
					>
						<Icon name="exclamationmark.triangle.fill" size={16} color={m3.error} />
						<Text style={[m3Type.bodySmall, { flex: 1, color: m3.error }]}>
							{model.validationMessage}
						</Text>
					</View>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}
