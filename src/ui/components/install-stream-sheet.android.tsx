import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { Toasts, showToast } from '@/ui/toast';

import { useReduceMotion } from './accessibility';
import {
	consolePalette as palette,
	doneLabel,
	isTerminal,
	phaseLabel,
	phaseTint,
	servicePrefixEnd,
	type InstallStreamSheetProps
} from './install-stream.types';
import { monoFamily } from './type-scale';

export function InstallStreamSheet({
	operation,
	onCancel,
	onDone,
	onHide
}: InstallStreamSheetProps) {
	const accent = useAccentColor();
	const reduceMotion = useReduceMotion();
	const status = operation.status;
	const terminal = isTerminal(status);
	const tint = phaseTint(status) ?? accent;
	const scroll = useRef<ScrollViewInstance>(null);
	const [width, setWidth] = useState(0);
	const blink = useSharedValue(1);

	useEffect(() => {
		if (!terminal && !reduceMotion)
			blink.value = withRepeat(withTiming(0, { duration: 900 }), -1, true);
		else {
			cancelAnimation(blink);
			blink.value = 1;
		}
	}, [terminal, reduceMotion, blink]);
	const dotStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * blink.value }));
	const cursorStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * blink.value }));

	const copyTranscript = async () => {
		await Clipboard.setStringAsync(operation.lines.map((l) => l.text).join('\n'));
		showToast(Toasts.copied('Logs copied'));
	};

	const flatButton = (title: string, textColor: string, fill: string, onPress: () => void) => (
		<Pressable
			key={title}
			onPress={onPress}
			accessibilityRole="button"
			android_ripple={{ color: '#FFFFFF33' }}
			style={{
				flex: 1,
				height: 46,
				borderRadius: 23,
				overflow: 'hidden',
				backgroundColor: fill,
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>{title}</Text>
		</Pressable>
	);

	return (
		<View style={{ flex: 1, backgroundColor: palette.background }}>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 10,
					paddingHorizontal: 20,
					paddingTop: 22,
					paddingBottom: 14
				}}
			>
				<Animated.View
					style={[{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: tint }, dotStyle]}
				/>
				<Text
					numberOfLines={1}
					ellipsizeMode="middle"
					style={{
						flexShrink: 1,
						fontFamily: monoFamily,
						fontSize: 14,
						fontWeight: '600',
						color: palette.text
					}}
				>
					{operation.title}
				</Text>
				<View style={{ flex: 1, minWidth: 12 }} />
				{operation.isServerSynced && !terminal ? (
					<View accessible accessibilityLabel="Following the server activity">
						<Icon name="antenna.radiowaves.left.and.right" size={12} color={palette.dim} />
					</View>
				) : null}
				<Text numberOfLines={1} style={{ fontFamily: monoFamily, fontSize: 12, color: tint }}>
					{phaseLabel(operation)}
				</Text>
			</View>

			<View
				style={{ height: 2, backgroundColor: palette.rule }}
				onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
			>
				{operation.progressFraction !== undefined && !terminal ? (
					<View
						style={{ height: 2, width: width * operation.progressFraction, backgroundColor: tint }}
					/>
				) : terminal ? (
					<View style={{ height: 2, backgroundColor: tint }} />
				) : null}
			</View>

			<ScrollView
				ref={scroll}
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 4 }}
				onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
			>
				{operation.lines.map((line) => {
					const text = line.text === '' ? ' ' : line.text;
					const prefixEnd = line.isError ? undefined : servicePrefixEnd(line.text);
					return (
						<Text
							key={line.id}
							selectable
							style={{
								fontFamily: monoFamily,
								fontSize: 12,
								color: line.isError ? systemColors.red : palette.text
							}}
						>
							{prefixEnd !== undefined ? (
								<>
									<Text style={{ color: accent }}>{text.slice(0, prefixEnd)}</Text>
									{text.slice(prefixEnd)}
								</>
							) : (
								text
							)}
						</Text>
					);
				})}
				{!terminal ? (
					<Animated.Text
						style={[
							{
								fontFamily: monoFamily,
								fontSize: 12,
								color: operation.lines.length === 0 ? palette.dim : palette.text
							},
							cursorStyle
						]}
					>
						{operation.lines.length === 0 ? 'starting ▊' : '▊'}
					</Animated.Text>
				) : operation.lines.length === 0 ? (
					<Text style={{ fontFamily: monoFamily, fontSize: 12, color: palette.dim }}>
						no output
					</Text>
				) : null}
			</ScrollView>

			<View
				style={{
					paddingHorizontal: 20,
					paddingTop: 12,
					paddingBottom: 16,
					gap: 8,
					alignItems: 'center'
				}}
			>
				<View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
					<Pressable
						onPress={() => void copyTranscript()}
						disabled={operation.lines.length === 0}
						accessibilityRole="button"
						accessibilityLabel="Copy log to clipboard"
						android_ripple={{ color: '#FFFFFF33', borderless: true }}
						style={{
							width: 46,
							height: 46,
							borderRadius: 23,
							backgroundColor: palette.buttonFill,
							alignItems: 'center',
							justifyContent: 'center',
							opacity: operation.lines.length === 0 ? 0.4 : 1
						}}
					>
						<Icon name="doc.on.clipboard" size={18} color={palette.text} />
					</Pressable>
					{!terminal ? (
						<>
							{flatButton('Cancel', systemColors.red, palette.buttonFill, onCancel)}
							{flatButton('Hide', '#FFFFFF', accent, onHide)}
						</>
					) : (
						flatButton(doneLabel(status), '#FFFFFF', tint, () => {
							onDone();
							onHide();
						})
					)}
				</View>
				{!terminal ? (
					<Text style={{ fontFamily: monoFamily, fontSize: 11, color: palette.dim }}>
						Hiding keeps the operation running.
					</Text>
				) : null}
			</View>
		</View>
	);
}
