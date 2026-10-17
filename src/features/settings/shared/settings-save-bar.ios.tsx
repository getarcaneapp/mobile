import {
	Button,
	GlassEffectContainer,
	Namespace,
	ProgressView,
	Section,
	Spacer,
	ZStack
} from '@expo/ui/swift-ui';
import { Host } from '@/ui/host';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	frame,
	glassEffectId,
	listRowBackground,
	listRowInsets,
	listRowSeparator,
	listSectionSpacing,
	offset,
	opacity,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { useId } from 'react';
import { View } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/components/accessibility';
import { glassChipCompat, glassEffectCompat, isIOS26 } from '@/ui/components/swiftui-surfaces';
import { motionAwareAnimation } from '@/ui/components/swiftui-motion';

import {
	saveBarState,
	settingsSaveBarHeight,
	type SettingsSaveBarProps
} from './settings-save-bar.types';

export { settingsSaveBarHeight } from './settings-save-bar.types';

export function SettingsSaveBar(props: SettingsSaveBarProps) {
	const {
		isPresented = true,
		hasChanges,
		isSaving,
		saveAccessibilityLabel = 'Save',
		onSave,
		onRevert,
		reservesTabBarSpace = true
	} = props;
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const namespace = useId();
	const insets = useSafeAreaInsets();
	const bottomInset = reservesTabBarSpace
		? insets.bottom
		: (initialWindowMetrics?.insets.bottom ?? insets.bottom);
	if (!isPresented) return null;
	const { saveDisabled, revertDisabled } = saveBarState(props);

	const buttons = (
		<ZStack
			modifiers={[
				frame({ width: 114, height: 52 }),
				...motionAwareAnimation(Motion.state, hasChanges, reduceMotion)
			]}
		>
			{hasChanges ? (
				<Button
					onPress={onRevert}
					modifiers={[
						buttonStyle('plain'),
						frame({ width: 52, height: 52 }),
						contentShape(shapes.circle()),
						glassEffectCompat({ tint: systemColors.orange, interactive: true, shape: 'circle' }),
						...(isIOS26 ? [glassEffectId('settings-revert', namespace)] : []),
						accessibilityLabel('Revert Changes'),
						disabled(revertDisabled),
						opacity(revertDisabled ? 0.6 : 1),
						offset({ x: -31 })
					]}
				>
					<Image
						systemName="arrow.uturn.backward"
						modifiers={[
							font({ textStyle: 'title2', weight: 'semibold' }),
							foregroundStyle('#FFFFFF')
						]}
					/>
				</Button>
			) : null}
			<Button
				onPress={onSave}
				modifiers={[
					buttonStyle('plain'),
					frame({ width: 52, height: 52 }),
					contentShape(shapes.circle()),
					glassChipCompat({ tint: accent, interactive: true, shape: 'circle' }),
					...(isIOS26 ? [glassEffectId('settings-save', namespace)] : []),
					accessibilityLabel(saveAccessibilityLabel),
					disabled(saveDisabled),
					opacity(saveDisabled && !isSaving ? 0.6 : 1),
					offset({ x: 31 })
				]}
			>
				{isSaving ? (
					<ProgressView modifiers={[tint('#FFFFFF')]} />
				) : (
					<Image
						systemName="checkmark"
						modifiers={[
							font({ textStyle: 'title', weight: 'semibold' }),
							foregroundStyle('#FFFFFF')
						]}
					/>
				)}
			</Button>
		</ZStack>
	);

	return (
		<View
			pointerEvents="box-none"
			style={{
				position: 'absolute',
				right: 0,
				bottom: bottomInset,
				width: 114 + 36,
				height: settingsSaveBarHeight,
				paddingRight: 18,
				paddingTop: 10,
				paddingBottom: 18
			}}
		>
			<Host style={{ flex: 1 }} alignment="topTrailing">
				<Namespace id={namespace}>
					{isIOS26 ? <GlassEffectContainer spacing={10}>{buttons}</GlassEffectContainer> : buttons}
				</Namespace>
			</Host>
		</View>
	);
}

export function SettingsSaveBarSpacer({
	isPresented = true,
	afterFooterlessSection = false
}: {
	isPresented?: boolean;
	afterFooterlessSection?: boolean;
}) {
	if (!isPresented) return null;
	return (
		<Section modifiers={[listSectionSpacing(0)]}>
			<Spacer
				minLength={0}
				modifiers={[
					frame({ height: settingsSaveBarHeight - 36 + (afterFooterlessSection ? 36 : 0) }),
					listRowBackground('#00000000'),
					listRowSeparator('hidden'),
					listRowInsets({ top: 0, bottom: 0 })
				]}
			/>
		</Section>
	);
}
