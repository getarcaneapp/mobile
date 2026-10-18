import { Host } from '@/ui/host';
import { AlertAnchor } from '@/ui/components/alert-anchor';
import {
	Alert,
	Button,
	Divider,
	HStack,
	ProgressView,
	RNHostView,
	RoundedRectangle,
	ScrollView,
	SecureField,
	Spacer,
	Text,
	TextField,
	VStack,
	ZStack,
	useNativeState,
	type SecureFieldRef,
	type TextFieldRef
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	accessibilityHint,
	accessibilityLabel,
	animation,
	autocorrectionDisabled,
	background,
	buttonStyle,
	contentShape,
	containerRelativeFrame,
	contentTransition,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	keyboardType,
	lineLimit,
	minimumScaleFactor,
	multilineTextAlignment,
	onAppear,
	onSubmit,
	onTapGesture,
	opacity,
	strokeBorder,
	padding,
	scaleEffect,
	scrollDismissesKeyboard,
	shadow,
	shapes,
	submitLabel,
	textContentType,
	textInputAutocapitalization,
	tint,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Image as ExpoImage } from 'expo-image';
import {
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
	type RefObject
} from 'react';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors, withOpacity } from '@/theme/colors';
import { Motion, Radius } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';
import { ErrorBanner } from '@/ui/components/error-banner';
import { hashKey, swiftAnimation } from '@/ui/components/swiftui-motion';
import { glassEffectCompat, isIOS26 as isGlass } from '@/ui/components/swiftui-surfaces';

import { useLoginModel, type LoginField, type LoginModel } from './use-login-model';

const logo = require('@/assets/brand/logo.svg');

type TextState = ReturnType<typeof useNativeState<string>>;

type Texts = {
	serverURL: TextState;
	username: TextState;
	password: TextState;
	recoveryCode: TextState;
};

type Refs = {
	serverURL: RefObject<TextFieldRef | null>;
	username: RefObject<TextFieldRef | null>;
	password: RefObject<SecureFieldRef | null>;
	recoveryCode: RefObject<TextFieldRef | null>;
};

export function LoginScreen() {
	const model = useLoginModel();
	const reduceMotion = useReduceMotion();
	const serverURLRef = useRef<TextFieldRef>(null);
	const usernameRef = useRef<TextFieldRef>(null);
	const passwordRef = useRef<SecureFieldRef>(null);
	const recoveryCodeRef = useRef<TextFieldRef>(null);
	const refs: Refs = {
		serverURL: serverURLRef,
		username: usernameRef,
		password: passwordRef,
		recoveryCode: recoveryCodeRef
	};

	const ignore = () => {};
	useLayoutEffect(() => {
		model.bindFocus((field: LoginField | null) => {
			if (field) refs[field].current?.focus().catch(ignore);
			else for (const ref of Object.values(refs)) ref.current?.blur().catch(ignore);
		});
	});

	const { serverURL, username, password, recoveryCode } = model;
	const serverURLText = useNativeState(serverURL);
	const usernameText = useNativeState(username);
	const passwordText = useNativeState(password);
	const recoveryCodeText = useNativeState(recoveryCode);
	const texts = {
		serverURL: serverURLText,
		username: usernameText,
		password: passwordText,
		recoveryCode: recoveryCodeText
	};
	const syncTexts = useEffectEvent(
		(values: { serverURL: string; username: string; password: string; recoveryCode: string }) => {
			if (texts.serverURL.get() !== values.serverURL) texts.serverURL.set(values.serverURL);
			if (texts.username.get() !== values.username) texts.username.set(values.username);
			if (texts.password.get() !== values.password) texts.password.set(values.password);
			if (texts.recoveryCode.get() !== values.recoveryCode)
				texts.recoveryCode.set(values.recoveryCode);
		}
	);
	useEffect(() => {
		syncTexts({ serverURL, username, password, recoveryCode });
	}, [serverURL, username, password, recoveryCode]);

	const entrance = (value: number | boolean) =>
		reduceMotion ? [] : [animation(swiftAnimation(Motion.entrance), value)];
	const state = (value: number | boolean) =>
		reduceMotion ? [] : [animation(swiftAnimation(Motion.state), value)];

	return (
		<View style={{ flex: 1 }}>
			<LoginBackground brandColor={model.brandColor} />
			<Host style={{ flex: 1 }}>
				<VStack spacing={0}>
					{model.showsDemoBanner ? <DemoOfferBanner model={model} /> : null}
					<ScrollView modifiers={[scrollDismissesKeyboard('interactively')]}>
						<VStack
							spacing={0}
							modifiers={[
								padding({ horizontal: 24, vertical: 24 }),
								frame({ maxWidth: Infinity }),
								containerRelativeFrame({ axes: 'vertical', alignment: 'center' }),
								contentShape(shapes.rectangle()),
								onTapGesture(model.dismissKeyboard),
								...entrance(model.isSetupMode),
								...entrance(hashKey(model.errorMessage ?? '')),
								...entrance(model.isStartingDemo),
								...state(model.isLoading),
								...state(model.isUsingSavedSignIn),
								...entrance(model.pendingMFAChallenge !== undefined),
								...entrance(model.isOIDCAvailable),
								...entrance(model.isLocalAuthAvailable)
							]}
						>
							<Spacer minLength={0} />
							<Header model={model} />
							{!model.isStartingDemo ? (
								<VStack spacing={12} modifiers={[padding({ top: 28 })]}>
									<FormCard model={model} refs={refs} texts={texts} />
									{model.errorMessage ? <ErrorBanner message={model.errorMessage} /> : null}
									{model.demoExpiredMessage ? (
										<InfoBanner
											message={model.demoExpiredMessage}
											onDismiss={model.dismissDemoExpiredMessage}
										/>
									) : null}
									<Actions model={model} />
								</VStack>
							) : null}
							<Spacer minLength={0} />
						</VStack>
					</ScrollView>
					{model.focusedField !== null ? (
						<HStack modifiers={[padding({ horizontal: 16, bottom: 12 })]}>
							<Spacer />
							<Button
								label="Done"
								onPress={model.dismissKeyboard}
								modifiers={[buttonStyle('bordered'), controlSize('large')]}
							/>
						</HStack>
					) : null}
				</VStack>
				<Alert
					title="Use Saved Sign-In?"
					isPresented={model.savedSignInOffer !== undefined}
					onIsPresentedChange={(presented) => {
						if (!presented) model.declineSavedSignIn();
					}}
				>
					<AlertAnchor />
					<Alert.Actions>
						<Button label="Use Saved Sign-In" onPress={model.acceptSavedSignIn} />
						<Button label="Not Now" role="cancel" onPress={model.declineSavedSignIn} />
					</Alert.Actions>
					<Alert.Message>
						<Text>{model.savedSignInPrompt(model.savedSignInOffer?.profile.name ?? '')}</Text>
					</Alert.Message>
				</Alert>
			</Host>
		</View>
	);
}

function LoginBackground({ brandColor }: { brandColor: string }) {
	return (
		<View
			pointerEvents="none"
			style={{
				position: 'absolute',
				inset: 0,
				experimental_backgroundImage: [
					`radial-gradient(circle 220px at 50% 20%, ${withOpacity(brandColor, 0.1)}, transparent)`,
					`linear-gradient(135deg, transparent, ${withOpacity(brandColor, 0.06)})`
				].join(', ')
			}}
		/>
	);
}

function Header({ model }: { model: LoginModel }) {
	const reduceMotion = useReduceMotion();
	const [logoAppeared, setLogoAppeared] = useState(reduceMotion);
	const shown = logoAppeared || reduceMotion;
	return (
		<VStack spacing={12}>
			<ZStack
				modifiers={[
					frame({ width: 76, height: 76 }),
					padding({ all: 20 }),
					glassEffectCompat({ shape: 'roundedRectangle', cornerRadius: Radius.hero }),
					shadow({ color: '#0000001A', radius: 10, y: 4 }),
					scaleEffect(shown ? 1 : 0.7),
					opacity(shown ? 1 : 0),
					...(reduceMotion
						? []
						: [animation(swiftAnimation(Motion.logoEntrance).delay(0.08), shown)]),
					onAppear(() => setLogoAppeared(true))
				]}
			>
				<RNHostView matchContents>
					<ExpoImage source={logo} style={{ width: 76, height: 76 }} contentFit="contain" />
				</RNHostView>
				<RoundedRectangle
					cornerRadius={Radius.hero}
					modifiers={[
						foregroundStyle('#00000000'),
						strokeBorder({
							content: withOpacity('#FFFFFF', 0.12),
							style: { lineWidth: 1 },
							shape: 'roundedRectangle',
							cornerRadius: Radius.hero
						}),
						padding({ all: -20 }),
						accessibilityHidden(true)
					]}
				/>
			</ZStack>
			<VStack spacing={8}>
				<Text modifiers={[font({ textStyle: 'title', weight: 'bold' })]}>Arcane</Text>
				<Text
					modifiers={[
						font({ textStyle: 'body' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						multilineTextAlignment('center'),
						contentTransition('opacity')
					]}
				>
					{model.headerSubtitle}
				</Text>
				{model.showsServerChip ? <ServerChip model={model} /> : null}
			</VStack>
		</VStack>
	);
}

function ServerChip({ model }: { model: LoginModel }) {
	return (
		<Button
			onPress={model.showServerSetup}
			modifiers={[
				buttonStyle('plain'),
				glassEffectCompat({ shape: 'capsule' }),
				accessibilityLabel(`Server ${model.serverDisplayName}. Change server`)
			]}
		>
			<HStack
				spacing={7}
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'medium' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					padding({ horizontal: 14, vertical: 9 }),
					contentShape(shapes.capsule())
				]}
			>
				<Image systemName="server.rack" modifiers={[font({ textStyle: 'footnote' })]} />
				<Text modifiers={[lineLimit(1), truncationMode('middle')]}>{model.serverDisplayName}</Text>
				<Image
					systemName="chevron.right"
					modifiers={[
						font({ textStyle: 'footnote', weight: 'semibold' }),
						foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
					]}
				/>
			</HStack>
		</Button>
	);
}

const cardGlass = () => glassEffectCompat({ shape: 'roundedRectangle', cornerRadius: Radius.card });

function FormCard({ model, refs, texts }: { model: LoginModel; refs: Refs; texts: Texts }) {
	const {
		serverURL: serverURLRef,
		username: usernameRef,
		password: passwordRef,
		recoveryCode: recoveryCodeRef
	} = refs;
	if (model.isSetupMode) {
		return (
			<VStack spacing={8}>
				<ZStack modifiers={[cardGlass()]}>
					<FieldRow icon="server.rack" label="Server URL">
						<TextField
							ref={serverURLRef}
							text={texts.serverURL}
							placeholder="arcane.example.com"
							onTextChange={model.setServerURL}
							onFocusChange={(focused) => model.setFocused('serverURL', focused)}
							modifiers={[
								textInputAutocapitalization('never'),
								autocorrectionDisabled(),
								keyboardType('url'),
								textContentType('URL'),
								submitLabel('go'),
								onSubmit(model.connectToServer)
							]}
						/>
					</FieldRow>
				</ZStack>
				<Button
					onPress={model.openConnectionProfiles}
					modifiers={[
						buttonStyle('plain'),
						cardGlass(),
						accessibilityHint('Opens saved Arcane server profiles')
					]}
				>
					<HStack
						spacing={12}
						modifiers={[
							padding({ horizontal: 14, vertical: 11 }),
							contentShape(shapes.rectangle())
						]}
					>
						<Image
							systemName="person.crop.rectangle.stack.fill"
							modifiers={[foregroundStyle(model.brandColor), frame({ width: 24 })]}
						/>
						<Text
							modifiers={[
								font({ textStyle: 'subheadline', weight: 'semibold' }),
								foregroundStyle('primary')
							]}
						>
							Connection Profiles
						</Text>
						<Spacer minLength={8} />
						<Image
							systemName="chevron.right"
							modifiers={[
								font({ textStyle: 'footnote', weight: 'semibold' }),
								foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
							]}
						/>
					</HStack>
				</Button>
			</VStack>
		);
	}
	if (model.pendingMFAChallenge) {
		return (
			<VStack spacing={0} modifiers={[cardGlass()]}>
				<FieldRow icon="key.viewfinder" label="Recovery Code">
					<TextField
						ref={recoveryCodeRef}
						text={texts.recoveryCode}
						placeholder="Enter recovery code"
						onTextChange={model.setRecoveryCode}
						onFocusChange={(focused) => model.setFocused('recoveryCode', focused)}
						modifiers={[
							textInputAutocapitalization('never'),
							autocorrectionDisabled(),
							textContentType('oneTimeCode'),
							submitLabel('go'),
							onSubmit(model.completeMFAWithRecoveryCode)
						]}
					/>
				</FieldRow>
			</VStack>
		);
	}
	if (!model.shouldShowPasswordFields) return null;
	return (
		<VStack spacing={0} modifiers={[cardGlass()]}>
			<FieldRow icon="person" label="Username">
				<TextField
					ref={usernameRef}
					text={texts.username}
					placeholder="Username"
					onTextChange={model.setUsername}
					onFocusChange={(focused) => model.setFocused('username', focused)}
					modifiers={[
						textInputAutocapitalization('never'),
						autocorrectionDisabled(),
						textContentType('username'),
						submitLabel('next'),
						onSubmit(() => model.focus('password'))
					]}
				/>
			</FieldRow>
			<Divider modifiers={[padding({ leading: 16 })]} />
			<FieldRow icon="lock" label="Password">
				<SecureField
					ref={passwordRef}
					text={texts.password}
					placeholder="Password"
					onTextChange={model.setPassword}
					onFocusChange={(focused) => model.setFocused('password', focused)}
					modifiers={[textContentType('password'), submitLabel('go'), onSubmit(model.signIn)]}
				/>
			</FieldRow>
		</VStack>
	);
}

function FieldRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
	return (
		<HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 18 })]}>
			<Image
				systemName={icon as SFSymbol}
				modifiers={[
					font({ textStyle: 'body' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					frame({ width: 22 }),
					accessibilityHidden(true)
				]}
			/>
			<ZStack modifiers={[font({ textStyle: 'body' }), accessibilityLabel(label)]}>
				{children}
			</ZStack>
		</HStack>
	);
}

function InfoBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
	return (
		<HStack
			alignment="top"
			spacing={10}
			modifiers={[
				padding({ all: 14 }),
				background(
					withOpacity(systemColors.blue, 0.12),
					shapes.roundedRectangle({
						cornerRadius: Radius.standard,
						roundedCornerStyle: 'continuous'
					})
				)
			]}
		>
			<Image systemName="info.circle.fill" modifiers={[foregroundStyle(systemColors.blue)]} />
			<Text
				modifiers={[
					font({ textStyle: 'subheadline' }),
					foregroundStyle('primary'),
					multilineTextAlignment('leading')
				]}
			>
				{message}
			</Text>
			<Spacer minLength={0} />
			<Button onPress={onDismiss} modifiers={[buttonStyle('plain')]}>
				<Image
					systemName="xmark"
					modifiers={[
						font({ textStyle: 'caption', weight: 'bold' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				/>
			</Button>
		</HStack>
	);
}

function Actions({ model }: { model: LoginModel }) {
	if (model.isSetupMode) {
		return (
			<VStack spacing={10}>
				<PrimaryButton
					title="Connect"
					icon="arrow.right"
					loading={model.isLoading && !model.isStartingDemo}
					disabled={!model.serverURL || model.isLoading}
					onPress={model.connectToServer}
				/>
				{model.mode === 'login' ? (
					<Button
						label="Cancel"
						onPress={model.cancelServerSetup}
						modifiers={[buttonStyle('borderless'), controlSize('large'), tint('secondary')]}
					/>
				) : null}
			</VStack>
		);
	}
	if (model.pendingMFAChallenge) {
		return (
			<VStack spacing={10}>
				<PrimaryButton
					title="Continue with Passkey"
					icon="person.badge.key.fill"
					loading={model.isPasskeySigningIn}
					disabled={model.isLoading || model.isPasskeySigningIn}
					onPress={model.completeMFAWithPasskey}
				/>
				<SecondaryButton
					title="Use Recovery Code"
					icon="key.viewfinder"
					loading={model.isLoading}
					disabled={!model.recoveryCode.trim() || model.secondaryDisabled}
					onPress={model.completeMFAWithRecoveryCode}
				/>
				<Button
					label="Back to Sign In"
					onPress={model.backToSignIn}
					modifiers={[buttonStyle('borderless'), controlSize('large'), tint('secondary')]}
				/>
			</VStack>
		);
	}
	return (
		<VStack spacing={10}>
			{model.isOIDCAvailable && (!model.isLocalAuthAvailable || !model.showsPasswordForm) ? (
				<PrimaryButton
					title={`Continue with ${model.providerDisplayName}`}
					icon="key.fill"
					loading={model.isOIDCSigningIn}
					disabled={model.isLoading || model.isOIDCSigningIn}
					onPress={model.signInWithOIDC}
				/>
			) : model.isLocalAuthAvailable ? (
				<PrimaryButton
					title="Sign In"
					icon="person.fill.checkmark"
					loading={model.isLoading || model.isUsingSavedSignIn}
					disabled={
						!model.username || !model.password || model.isLoading || model.isUsingSavedSignIn
					}
					onPress={model.signIn}
				/>
			) : null}
			<HStack spacing={10}>
				<SecondaryButton
					title="Passkey"
					icon="person.badge.key.fill"
					loading={model.isPasskeySigningIn}
					disabled={model.secondaryDisabled}
					onPress={model.signInWithPasskey}
				/>
				{model.isOIDCAvailable && model.isLocalAuthAvailable ? (
					model.showsPasswordForm ? (
						<SecondaryButton
							title={model.providerDisplayName}
							icon="key.fill"
							loading={model.isOIDCSigningIn}
							disabled={model.secondaryDisabled}
							onPress={model.signInWithOIDC}
						/>
					) : (
						<SecondaryButton
							title="Password"
							icon="lock.fill"
							loading={false}
							disabled={model.secondaryDisabled}
							onPress={model.revealPasswordForm}
						/>
					)
				) : null}
			</HStack>
		</VStack>
	);
}

type ActionButtonProps = {
	title: string;
	icon: string;
	loading: boolean;
	disabled: boolean;
	onPress: () => void;
};

function ButtonLabel({
	title,
	icon,
	loading,
	scale
}: {
	title: string;
	icon: string;
	loading: boolean;
	scale: number;
}) {
	return (
		<ZStack modifiers={[font({ textStyle: 'headline' }), frame({ maxWidth: Infinity })]}>
			<HStack
				spacing={6}
				modifiers={[opacity(loading ? 0 : 1), lineLimit(1), minimumScaleFactor(scale)]}
			>
				<Image systemName={icon as SFSymbol} />
				<Text>{title}</Text>
			</HStack>
			{loading ? <ProgressView modifiers={[controlSize('regular')]} /> : null}
		</ZStack>
	);
}

function PrimaryButton({ title, icon, loading, disabled: isDisabled, onPress }: ActionButtonProps) {
	return (
		<Button
			onPress={onPress}
			modifiers={[
				buttonStyle(isGlass ? 'glassProminent' : 'borderedProminent'),
				controlSize('extraLarge'),
				disabled(isDisabled)
			]}
		>
			<ButtonLabel title={title} icon={icon} loading={loading} scale={0.85} />
		</Button>
	);
}

function SecondaryButton({
	title,
	icon,
	loading,
	disabled: isDisabled,
	onPress
}: ActionButtonProps) {
	return (
		<Button
			onPress={onPress}
			modifiers={[
				buttonStyle(isGlass ? 'glass' : 'bordered'),
				controlSize('extraLarge'),
				disabled(isDisabled)
			]}
		>
			<ButtonLabel title={title} icon={icon} loading={loading} scale={0.8} />
		</Button>
	);
}

function DemoOfferBanner({ model }: { model: LoginModel }) {
	const reduceMotion = useReduceMotion();
	return (
		<Button
			onPress={model.startDemo}
			modifiers={[
				buttonStyle('plain'),
				glassEffectCompat({ shape: 'capsule' }),
				padding({ top: 4, bottom: 12 }),
				disabled(model.isLoading),
				opacity(model.isLoading && !model.isStartingDemo ? 0.5 : 1),
				...(reduceMotion ? [] : [animation(swiftAnimation(Motion.state), model.isStartingDemo)])
			]}
		>
			<HStack
				spacing={8}
				modifiers={[padding({ horizontal: 16, vertical: 10 }), contentShape(shapes.capsule())]}
			>
				{model.isStartingDemo ? (
					<ProgressView modifiers={[controlSize('small')]} />
				) : (
					<Image
						systemName="sparkles"
						modifiers={[
							font({ textStyle: 'subheadline', weight: 'semibold' }),
							foregroundStyle(model.brandColor)
						]}
					/>
				)}
				<Text
					modifiers={[
						font({ textStyle: 'subheadline', weight: 'semibold' }),
						foregroundStyle('primary'),
						lineLimit(1)
					]}
				>
					{model.isStartingDemo ? 'Starting demo…' : 'Try the demo'}
				</Text>
				{!model.isStartingDemo ? (
					<Image
						systemName="chevron.right"
						modifiers={[
							font({ textStyle: 'caption', weight: 'semibold' }),
							foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
						]}
					/>
				) : null}
			</HStack>
		</Button>
	);
}
