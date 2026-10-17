/**
 * Port of `SettingsSaveBar` / `.settingsSaveBar(...)` (SettingsSaveBar.swift):
 * floating Liquid Glass Save (checkmark) pinned trailing, with Revert morphing
 * out of it once the form is dirty.
 *
 * Standalone: renders its own `Host` pinned to the bottom edge of the screen.
 * Put it after the screen's main `Host` inside a `flex: 1` container, and end
 * the Form with `<SettingsSaveBarSpacer />` so the last rows can scroll clear.
 */
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
	// Inside a sheet the safe-area context still reports the presenting tab stack's
	// bottom inset (tab bar included), which floated Save ~50pt too high. Sheets
	// sit above the home indicator only: use the window's own bottom inset.
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
		// Inside tab stacks the bottom inset already includes the tab bar, like SwiftUI's safe area.
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
			{/* Pin the 114pt lane trailing (Swift: `.frame(maxWidth: .infinity, alignment: .trailing)`); the
          host is wider than the lane, and its default topLeading alignment left Save ~18pt too far left. */}
			<Host style={{ flex: 1 }} alignment="topTrailing">
				<Namespace id={namespace}>
					{isIOS26 ? <GlassEffectContainer spacing={10}>{buttons}</GlassEffectContainer> : buttons}
				</Namespace>
			</Host>
		</View>
	);
}

/**
 * `.safeAreaInset(edge: .bottom)` room for the floating bar: a clear trailing
 * row. SwiftUI still adds a section gap before it even with zero section
 * spacing, so the row is the bar's height minus ~36pt, which is also the List's
 * 44pt minimum row height. Measured against the reference app's Account screen,
 * scrolling stops within ~9pt of where it does there.
 */
export function SettingsSaveBarSpacer({
	isPresented = true,
	afterFooterlessSection = false
}: {
	isPresented?: boolean;
	/**
	 * The Form's last section has no footer (e.g. Timeouts). SwiftUI then leaves
	 * less room above this row, so add 36pt to stop at the same place as the
	 * reference (measured on Timeouts; Account, which ends in a footer, is unchanged).
	 */
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
