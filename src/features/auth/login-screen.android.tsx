import { Image } from 'expo-image';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
	ActivityIndicator,
	Alert,
	Pressable,
	Text,
	TextInput,
	View,
	type TextInputInstance,
	type TextInputProps
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
	FadeIn,
	FadeOut,
	LinearTransition,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSpring
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, systemColors, withOpacity } from '@/theme/colors';
import { springConfig } from '@/theme/motion';
import { Motion, Radius } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';
import { ErrorBanner } from '@/ui/components/error-banner';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { useLoginModel, type LoginField, type LoginModel } from './use-login-model';

const logo = require('@/assets/brand/logo.svg');

const entranceSpring = springConfig(Motion.entrance.response, Motion.entrance.dampingFraction);
const logoSpring = springConfig(Motion.logoEntrance.response, Motion.logoEntrance.dampingFraction);

type Refs = Record<LoginField, RefObject<TextInputInstance | null>>;

export function LoginScreen() {
	const model = useLoginModel();
	const reduceMotion = useReduceMotion();
	const refs: Refs = {
		serverURL: useRef<TextInputInstance>(null),
		username: useRef<TextInputInstance>(null),
		password: useRef<TextInputInstance>(null),
		recoveryCode: useRef<TextInputInstance>(null)
	};
	model.bindFocus((field) => {
		if (field) refs[field].current?.focus();
		else for (const ref of Object.values(refs)) ref.current?.blur();
	});

	const offer = model.savedSignInOffer;
	useEffect(() => {
		if (!offer) return;
		Alert.alert(
			'Use Saved Sign-In?',
			model.savedSignInPrompt(offer.profile.name),
			[
				{ text: 'Not Now', style: 'cancel', onPress: model.declineSavedSignIn },
				{ text: 'Use Saved Sign-In', onPress: model.acceptSavedSignIn }
			],
			{ cancelable: true, onDismiss: model.declineSavedSignIn }
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [offer]);

	const layout = reduceMotion
		? undefined
		: LinearTransition.springify().damping(entranceSpring.damping as number);
	const enter = reduceMotion ? undefined : FadeIn.reduceMotion(ReduceMotion.System);
	const exit = reduceMotion ? undefined : FadeOut.duration(Motion.earlyFade.duration);

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: colors.systemBackground }}
			edges={['top', 'bottom']}
		>
			<View
				pointerEvents="none"
				style={{
					position: 'absolute',
					inset: 0,
					experimental_backgroundImage: `radial-gradient(circle 220px at 50% 20%, ${withOpacity(model.brandColor, 0.1)}, transparent), linear-gradient(135deg, transparent, ${withOpacity(model.brandColor, 0.06)})`
				}}
			/>
			<KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
				{model.showsDemoBanner ? <DemoOfferChip model={model} /> : null}
				<Animated.ScrollView
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="interactive"
					contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
				>
					<Pressable onPress={model.dismissKeyboard} accessible={false} style={{ gap: 28 }}>
						<Header model={model} />
						{!model.isStartingDemo ? (
							<Animated.View layout={layout} entering={enter} exiting={exit} style={{ gap: 12 }}>
								<FormCard model={model} refs={refs} />
								{model.errorMessage ? (
									<Animated.View entering={enter} exiting={exit}>
										<ErrorBanner message={model.errorMessage} />
									</Animated.View>
								) : null}
								{model.demoExpiredMessage ? (
									<InfoBanner
										message={model.demoExpiredMessage}
										onDismiss={model.dismissDemoExpiredMessage}
									/>
								) : null}
								<Actions model={model} />
							</Animated.View>
						) : null}
					</Pressable>
				</Animated.ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

function Header({ model }: { model: LoginModel }) {
	const reduceMotion = useReduceMotion();
	const appeared = useSharedValue(reduceMotion ? 1 : 0);
	useEffect(() => {
		if (!reduceMotion) appeared.value = withDelay(80, withSpring(1, logoSpring));
	}, [appeared, reduceMotion]);
	const logoStyle = useAnimatedStyle(() => ({
		opacity: appeared.value,
		transform: [{ scale: 0.7 + 0.3 * appeared.value }]
	}));

	return (
		<View style={{ alignItems: 'center', gap: 12 }}>
			<Animated.View
				style={[
					{
						padding: 20,
						borderRadius: Radius.hero,
						borderCurve: 'continuous',
						backgroundColor: m3.surfaceContainerHigh,
						elevation: 2
					},
					logoStyle
				]}
			>
				<Image
					source={logo}
					style={{ width: 76, height: 76 }}
					contentFit="contain"
					accessible={false}
				/>
			</Animated.View>
			<View style={{ alignItems: 'center', gap: 8 }}>
				<Text
					style={[m3Type.headlineSmall, { color: colors.label, fontWeight: '700' }]}
					accessibilityRole="header"
				>
					Arcane
				</Text>
				<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel, textAlign: 'center' }]}>
					{model.headerSubtitle}
				</Text>
				{model.showsServerChip ? (
					<Pressable
						onPress={model.showServerSetup}
						accessibilityRole="button"
						accessibilityLabel={`Server ${model.serverDisplayName}. Change server`}
						android_ripple={{
							color: withOpacity(m3.onSurfaceVariant as string, 0.12),
							borderless: false
						}}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 8,
							height: 32,
							paddingHorizontal: 12,
							borderRadius: 8,
							borderWidth: 1,
							borderColor: m3.outline,
							overflow: 'hidden',
							maxWidth: 320
						}}
					>
						<Icon name="server.rack" size={18} color={m3.onSurfaceVariant} />
						<Text
							style={[m3Type.labelLarge, { color: m3.onSurfaceVariant, flexShrink: 1 }]}
							numberOfLines={1}
							ellipsizeMode="middle"
						>
							{model.serverDisplayName}
						</Text>
						<Icon name="chevron.right" size={16} color={m3.onSurfaceVariant} />
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

function Card({ children }: { children: ReactNode }) {
	return (
		<View
			style={{
				borderRadius: Radius.card,
				borderCurve: 'continuous',
				backgroundColor: m3.surfaceContainerHigh,
				overflow: 'hidden'
			}}
		>
			{children}
		</View>
	);
}

function Field({
	inputRef,
	icon,
	label,
	field,
	model,
	...input
}: TextInputProps & {
	inputRef: RefObject<TextInputInstance | null>;
	icon: string;
	label: string;
	field: LoginField;
	model: LoginModel;
}) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingHorizontal: 16,
				minHeight: 60
			}}
		>
			<Icon name={icon} size={22} color={m3.onSurfaceVariant} />
			<TextInput
				ref={inputRef}
				accessibilityLabel={label}
				placeholderTextColor={colors.tertiaryLabel as string}
				cursorColor={m3.primary as string}
				selectionColor={withOpacity(m3.primary as string, 0.3)}
				onFocus={() => model.setFocused(field, true)}
				onBlur={() => model.setFocused(field, false)}
				style={[m3Type.bodyLarge, { flex: 1, color: colors.label, paddingVertical: 16 }]}
				{...input}
			/>
		</View>
	);
}

function FormCard({ model, refs }: { model: LoginModel; refs: Refs }) {
	if (model.isSetupMode) {
		return (
			<View style={{ gap: 8 }}>
				<Card>
					<Field
						inputRef={refs.serverURL}
						model={model}
						field="serverURL"
						icon="server.rack"
						label="Server URL"
						placeholder="arcane.example.com"
						value={model.serverURL}
						onChangeText={model.setServerURL}
						autoCapitalize="none"
						autoCorrect={false}
						keyboardType="url"
						autoComplete="url"
						returnKeyType="go"
						onSubmitEditing={model.connectToServer}
					/>
				</Card>
				<Card>
					<Pressable
						onPress={model.openConnectionProfiles}
						accessibilityRole="button"
						accessibilityHint="Opens saved Arcane server profiles"
						android_ripple={{ color: withOpacity(m3.onSurfaceVariant as string, 0.12) }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 12,
							paddingHorizontal: 16,
							minHeight: 56
						}}
					>
						<Icon name="person.crop.rectangle.stack.fill" size={22} color={model.brandColor} />
						<Text style={[m3Type.titleSmall, { flex: 1, color: colors.label }]}>
							Connection Profiles
						</Text>
						<Icon name="chevron.right" size={18} color={m3.onSurfaceVariant} />
					</Pressable>
				</Card>
			</View>
		);
	}
	if (model.pendingMFAChallenge) {
		return (
			<Card>
				<Field
					inputRef={refs.recoveryCode}
					model={model}
					field="recoveryCode"
					icon="key.viewfinder"
					label="Recovery Code"
					placeholder="Enter recovery code"
					value={model.recoveryCode}
					onChangeText={model.setRecoveryCode}
					autoCapitalize="none"
					autoCorrect={false}
					autoComplete="one-time-code"
					returnKeyType="go"
					onSubmitEditing={model.completeMFAWithRecoveryCode}
				/>
			</Card>
		);
	}
	if (!model.shouldShowPasswordFields) return null;
	return (
		<Card>
			<Field
				inputRef={refs.username}
				model={model}
				field="username"
				icon="person"
				label="Username"
				placeholder="Username"
				value={model.username}
				onChangeText={model.setUsername}
				autoCapitalize="none"
				autoCorrect={false}
				autoComplete="username"
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => model.focus('password')}
			/>
			<View
				style={{
					height: 1,
					marginLeft: 50,
					backgroundColor: withOpacity(m3.outline as string, 0.3)
				}}
			/>
			<Field
				inputRef={refs.password}
				model={model}
				field="password"
				icon="lock"
				label="Password"
				placeholder="Password"
				value={model.password}
				onChangeText={model.setPassword}
				secureTextEntry
				autoComplete="current-password"
				returnKeyType="go"
				onSubmitEditing={model.signIn}
			/>
		</Card>
	);
}

function InfoBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'flex-start',
				gap: 10,
				padding: 14,
				borderRadius: Radius.standard,
				borderCurve: 'continuous',
				backgroundColor: withOpacity(systemColors.blue, 0.12)
			}}
		>
			<Icon name="info.circle.fill" size={20} color={systemColors.blue} />
			<Text style={[m3Type.bodyMedium, { flex: 1, color: colors.label }]}>{message}</Text>
			<Pressable
				onPress={onDismiss}
				hitSlop={12}
				accessibilityRole="button"
				accessibilityLabel="Dismiss"
			>
				<Icon name="xmark" size={16} color={colors.secondaryLabel} />
			</Pressable>
		</View>
	);
}

function Actions({ model }: { model: LoginModel }) {
	if (model.isSetupMode) {
		return (
			<View style={{ gap: 10 }}>
				<FilledButton
					title="Connect"
					icon="arrow.right"
					loading={model.isLoading && !model.isStartingDemo}
					disabled={!model.serverURL || model.isLoading}
					onPress={model.connectToServer}
				/>
				{model.mode === 'login' ? (
					<TextButton title="Cancel" onPress={model.cancelServerSetup} />
				) : null}
			</View>
		);
	}
	if (model.pendingMFAChallenge) {
		return (
			<View style={{ gap: 10 }}>
				<FilledButton
					title="Continue with Passkey"
					icon="person.badge.key.fill"
					loading={model.isPasskeySigningIn}
					disabled={model.isLoading || model.isPasskeySigningIn}
					onPress={model.completeMFAWithPasskey}
				/>
				<TonalButton
					title="Use Recovery Code"
					icon="key.viewfinder"
					loading={model.isLoading}
					disabled={!model.recoveryCode.trim() || model.secondaryDisabled}
					onPress={model.completeMFAWithRecoveryCode}
				/>
				<TextButton title="Back to Sign In" onPress={model.backToSignIn} />
			</View>
		);
	}
	return (
		<View style={{ gap: 10 }}>
			{model.isOIDCAvailable && (!model.isLocalAuthAvailable || !model.showsPasswordForm) ? (
				<FilledButton
					title={`Continue with ${model.providerDisplayName}`}
					icon="key.fill"
					loading={model.isOIDCSigningIn}
					disabled={model.isLoading || model.isOIDCSigningIn}
					onPress={model.signInWithOIDC}
				/>
			) : model.isLocalAuthAvailable ? (
				<FilledButton
					title="Sign In"
					icon="person.fill.checkmark"
					loading={model.isLoading || model.isUsingSavedSignIn}
					disabled={
						!model.username || !model.password || model.isLoading || model.isUsingSavedSignIn
					}
					onPress={model.signIn}
				/>
			) : null}
			<View style={{ flexDirection: 'row', gap: 10 }}>
				<TonalButton
					title="Passkey"
					icon="person.badge.key.fill"
					loading={model.isPasskeySigningIn}
					disabled={model.secondaryDisabled}
					onPress={model.signInWithPasskey}
				/>
				{model.isOIDCAvailable && model.isLocalAuthAvailable ? (
					model.showsPasswordForm ? (
						<TonalButton
							title={model.providerDisplayName}
							icon="key.fill"
							loading={model.isOIDCSigningIn}
							disabled={model.secondaryDisabled}
							onPress={model.signInWithOIDC}
						/>
					) : (
						<TonalButton
							title="Password"
							icon="lock.fill"
							loading={false}
							disabled={model.secondaryDisabled}
							onPress={model.revealPasswordForm}
						/>
					)
				) : null}
			</View>
		</View>
	);
}

type ButtonProps = {
	title: string;
	icon: string;
	loading: boolean;
	disabled: boolean;
	onPress: () => void;
};

function M3Button({
	title,
	icon,
	loading,
	disabled,
	onPress,
	container,
	content
}: ButtonProps & { container: string; content: string }) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={title}
			accessibilityState={{ disabled, busy: loading }}
			android_ripple={{ color: withOpacity(content, 0.16) }}
			style={{
				flex: 1,
				minHeight: 56,
				borderRadius: 28,
				overflow: 'hidden',
				alignItems: 'center',
				justifyContent: 'center',
				paddingHorizontal: 20,
				backgroundColor: disabled ? withOpacity(colors.label as string, 0.12) : container
			}}
		>
			{loading ? (
				<ActivityIndicator color={content} />
			) : (
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<Icon
						name={icon}
						size={20}
						color={disabled ? withOpacity(colors.label as string, 0.38) : content}
					/>
					<Text
						numberOfLines={1}
						adjustsFontSizeToFit
						style={[
							m3Type.labelLarge,
							{
								fontSize: 16,
								color: disabled ? withOpacity(colors.label as string, 0.38) : content
							}
						]}
					>
						{title}
					</Text>
				</View>
			)}
		</Pressable>
	);
}

function FilledButton(props: ButtonProps) {
	return <M3Button {...props} container={m3.primary as string} content={m3.onPrimary as string} />;
}

function TonalButton(props: ButtonProps) {
	return (
		<M3Button
			{...props}
			container={m3.secondaryContainer as string}
			content={m3.onSecondaryContainer as string}
		/>
	);
}

function TextButton({ title, onPress }: { title: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: withOpacity(m3.primary as string, 0.12) }}
			style={{
				alignSelf: 'center',
				minHeight: 48,
				paddingHorizontal: 16,
				borderRadius: 24,
				overflow: 'hidden',
				justifyContent: 'center'
			}}
		>
			<Text style={[m3Type.labelLarge, { fontSize: 16, color: m3.primary }]}>{title}</Text>
		</Pressable>
	);
}

function DemoOfferChip({ model }: { model: LoginModel }) {
	const dimmed = model.isLoading && !model.isStartingDemo;
	return (
		<View
			style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 12, opacity: dimmed ? 0.5 : 1 }}
		>
			<Pressable
				onPress={model.startDemo}
				disabled={model.isLoading}
				accessibilityRole="button"
				android_ripple={{ color: withOpacity(m3.onSurfaceVariant as string, 0.12) }}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 8,
					height: 40,
					paddingHorizontal: 16,
					borderRadius: 20,
					overflow: 'hidden',
					backgroundColor: m3.surfaceContainerHigh
				}}
			>
				{model.isStartingDemo ? (
					<ActivityIndicator size="small" color={m3.primary as string} />
				) : (
					<Icon name="sparkles" size={18} color={model.brandColor} />
				)}
				<Text style={[m3Type.labelLarge, { color: colors.label }]}>
					{model.isStartingDemo ? 'Starting demo…' : 'Try the demo'}
				</Text>
				{!model.isStartingDemo ? (
					<Icon name="chevron.right" size={16} color={m3.onSurfaceVariant} />
				) : null}
			</Pressable>
		</View>
	);
}
