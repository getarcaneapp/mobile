/**
 * Android rendering of `SettingsSaveBar` (SettingsSaveBar.swift): a Material 3
 * FAB pair pinned bottom-end — a tonal Revert FAB that appears once the form is
 * dirty, and the primary Save FAB.
 *
 * Standalone. Put it after the screen's scroll view inside a `flex: 1`
 * container and pad the scroll content by `settingsSaveBarHeight`.
 */
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { Icon } from '@/ui/Icon';

import { saveBarState, type SettingsSaveBarProps } from './settings-save-bar.types';

export { settingsSaveBarHeight } from './settings-save-bar.types';

function Fab({
	icon,
	label,
	onPress,
	disabled,
	container,
	content,
	busy
}: {
	icon: string;
	label: string;
	onPress: () => void;
	disabled: boolean;
	container: string;
	content: string;
	busy?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled, busy }}
			android_ripple={{ color: colors.separator as string, borderless: false }}
			style={{
				width: 56,
				height: 56,
				borderRadius: 16,
				overflow: 'hidden',
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: container,
				opacity: disabled && !busy ? 0.6 : 1,
				elevation: 3
			}}
		>
			{busy ? (
				<ActivityIndicator color={content} />
			) : (
				<Icon name={icon} size={24} color={content} />
			)}
		</Pressable>
	);
}

export function SettingsSaveBar(props: SettingsSaveBarProps) {
	const {
		isPresented = true,
		hasChanges,
		isSaving,
		saveAccessibilityLabel = 'Save',
		onSave,
		onRevert
	} = props;
	const insets = useSafeAreaInsets();
	if (!isPresented) return null;
	const { saveDisabled, revertDisabled } = saveBarState(props);
	return (
		<View
			pointerEvents="box-none"
			style={{
				position: 'absolute',
				right: 16,
				bottom: insets.bottom + 16,
				flexDirection: 'row',
				gap: 12
			}}
		>
			{hasChanges ? (
				<Fab
					icon="arrow.uturn.backward"
					label="Revert Changes"
					onPress={onRevert}
					disabled={revertDisabled}
					container={m3.secondaryContainer as string}
					content={m3.onSecondaryContainer as string}
				/>
			) : null}
			<Fab
				icon="checkmark"
				label={saveAccessibilityLabel}
				onPress={onSave}
				disabled={saveDisabled}
				busy={isSaving}
				container={m3.primaryContainer as string}
				content={m3.onPrimaryContainer as string}
			/>
		</View>
	);
}

/** iOS-only Form spacer; nothing to render on Android (pad the scroll view instead). */
export function SettingsSaveBarSpacer(_props: {
	isPresented?: boolean;
	afterFooterlessSection?: boolean;
}) {
	return null;
}
