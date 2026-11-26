import { Button, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import {
	buttonStyle,
	controlSize,
	font,
	foregroundStyle,
	frame,
	padding
} from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { biometryTitle } from '@/core/app-lock/app-lock-policy';
import { useAppLock } from '@/core/app-lock/app-lock-store';
import { Keys, useStoredBool } from '@/core/storage';
import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { Image } from '@/ui/components/swiftui-image';
import { Host } from '@/ui/host';

import { ArcaneLockWindow } from '../../../modules/arcane-lock-window';

const unlockSymbol = {
	faceID: 'faceid',
	touchID: 'touchid',
	opticID: 'opticid',
	face: 'faceid',
	fingerprint: 'touchid',
	iris: 'opticid',
	none: 'lock.open.fill'
} as const;

export function AppLockOverlay() {
	return ArcaneLockWindow.isLinked ? <NativeLockWindow /> : <LockOverlayView />;
}

function NativeLockWindow() {
	const [enabled] = useStoredBool(Keys.appLockEnabled, false);
	const isLocked = useAppLock((s) => s.isLocked);
	const isAuthenticating = useAppLock((s) => s.isAuthenticating);
	const biometry = useAppLock((s) => s.biometry);
	const unlock = useAppLock((s) => s.unlock);
	const accent = useAccentColor();
	useEffect(() => ArcaneLockWindow.addUnlockListener(() => void unlock()), [unlock]);
	useEffect(() => {
		ArcaneLockWindow.update({
			enabled,
			locked: isLocked,
			busy: isAuthenticating,
			buttonTitle: `Unlock with ${biometryTitle(biometry, 'ios')}`,
			symbol: unlockSymbol[biometry],
			tintHex: accent.startsWith('#') ? accent : undefined
		});
	}, [enabled, isLocked, isAuthenticating, biometry, accent]);
	return null;
}

function LockOverlayView() {
	const isLocked = useAppLock((s) => s.isLocked);
	const isCovered = useAppLock((s) => s.isCovered);
	const isAuthenticating = useAppLock((s) => s.isAuthenticating);
	const biometry = useAppLock((s) => s.biometry);
	const unlock = useAppLock((s) => s.unlock);
	if (!isLocked && !isCovered) return null;
	return (
		<View style={[StyleSheet.absoluteFill, { backgroundColor: colors.systemBackground }]}>
			<Host style={{ flex: 1 }}>
				<VStack spacing={16} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
					<Image
						systemName="lock.fill"
						modifiers={[
							font({ size: 44 }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					/>
					<Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>
						Arcane Is Locked
					</Text>
					{isLocked ? (
						isAuthenticating ? (
							<ProgressView modifiers={[padding({ top: 8 })]} />
						) : (
							<Button
								onPress={() => void unlock()}
								modifiers={[
									buttonStyle('glassProminent'),
									controlSize('large'),
									padding({ top: 8 })
								]}
							>
								<Image systemName={unlockSymbol[biometry]} />
								<Text>{`Unlock with ${biometryTitle(biometry, 'ios')}`}</Text>
							</Button>
						)
					) : null}
				</VStack>
			</Host>
		</View>
	);
}
