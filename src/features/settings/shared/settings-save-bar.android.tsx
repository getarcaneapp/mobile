import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
	if (!isPresented || (!hasChanges && !isSaving)) return null;
	const { saveDisabled, revertDisabled } = saveBarState(props);
	return (
		<SafeAreaView
			edges={['bottom']}
			pointerEvents="box-none"
			style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
		>
			<View
				pointerEvents="box-none"
				style={{
					flexDirection: 'row',
					justifyContent: 'flex-end',
					gap: 12,
					padding: 16
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
		</SafeAreaView>
	);
}

export function SettingsSaveBarSpacer(_props: {
	isPresented?: boolean;
	afterFooterlessSection?: boolean;
}) {
	return null;
}
