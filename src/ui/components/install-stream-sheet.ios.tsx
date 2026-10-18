import { Host } from '@/ui/host';
import {
	Button,
	Circle,
	HStack,
	Rectangle,
	ScrollView,
	Spacer,
	Text,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	Animation,
	accessibilityLabel,
	animation,
	background,
	buttonStyle,
	contentTransition,
	disabled,
	environment,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	defaultScrollAnchorForRole,
	lineLimit,
	onGeometryChange,
	opacity,
	padding,
	shapes,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import * as Clipboard from 'expo-clipboard';
import { memo, useEffect, useState } from 'react';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { Motion } from '@/theme/tokens';
import { Toasts, showToast } from '@/ui/toast';

import { useReduceMotion } from './accessibility';
import {
	consolePalette as palette,
	doneLabel,
	isTerminal,
	phaseLabel,
	phaseTint,
	servicePrefixEnd,
	type InstallStreamLine,
	type InstallStreamSheetProps
} from './install-stream.types';
import { hashKey, motionAwareAnimation, swiftAnimation } from './swiftui-motion';

const mono = (textStyle: 'subheadline' | 'caption' | 'caption2', weight?: 'semibold') =>
	font({ textStyle, design: 'monospaced', weight });

const breathing = Animation.easeInOut({ duration: 0.9 }).repeat({
	repeatCount: 100_000,
	autoreverses: true
});

const LineRow = memo(function LineRow({
	line,
	accent
}: {
	line: InstallStreamLine;
	accent: string;
}) {
	const text = line.text === '' ? ' ' : line.text;
	const modifiers = [
		mono('caption'),
		frame({ maxWidth: Infinity, alignment: 'leading' }),
		fixedSize({ horizontal: false, vertical: true }),
		textSelection(true)
	];
	if (line.isError) {
		return <Text modifiers={[...modifiers, foregroundStyle(systemColors.red)]}>{text}</Text>;
	}
	const prefixEnd = servicePrefixEnd(line.text);
	if (prefixEnd === undefined)
		return <Text modifiers={[...modifiers, foregroundStyle(palette.text)]}>{text}</Text>;
	return (
		<Text modifiers={modifiers}>
			<Text modifiers={[foregroundStyle(accent)]}>{text.slice(0, prefixEnd)}</Text>
			<Text modifiers={[foregroundStyle(palette.text)]}>{text.slice(prefixEnd)}</Text>
		</Text>
	);
});

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
	const [cursorOn, setCursorOn] = useState(false);
	const [ruleWidth, setRuleWidth] = useState(0);

	useEffect(() => {
		setCursorOn(!terminal && !reduceMotion);
	}, [terminal, reduceMotion]);
	const dimmed = cursorOn && !terminal;
	const pulse = terminal || reduceMotion ? [] : [animation(breathing, dimmed)];

	const copyTranscript = async () => {
		await Clipboard.setStringAsync(operation.lines.map((l) => l.text).join('\n'));
		showToast(Toasts.copied('Logs copied'));
	};

	const flatButton = (title: string, textColor: string, fill: string, onPress: () => void) => (
		<Button key={title} onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline', weight: 'semibold' }),
					foregroundStyle(textColor),
					frame({ maxWidth: Infinity, minHeight: 46, maxHeight: 46 }),
					background(fill, shapes.capsule())
				]}
			>
				{title}
			</Text>
		</Button>
	);

	return (
		<Host style={{ flex: 1, backgroundColor: palette.background }}>
			<VStack
				spacing={0}
				modifiers={[
					background(palette.background),
					environment({ key: 'colorScheme', value: 'dark' })
				]}
			>
				<HStack spacing={10} modifiers={[padding({ horizontal: 20, top: 22, bottom: 14 })]}>
					<Circle
						modifiers={[
							foregroundStyle(tint),
							frame({ width: 9, height: 9 }),
							opacity(dimmed ? 0.35 : 1),
							...pulse
						]}
					/>
					<Text
						modifiers={[
							mono('subheadline', 'semibold'),
							foregroundStyle(palette.text),
							lineLimit(1),
							truncationMode('middle')
						]}
					>
						{operation.title}
					</Text>
					<Spacer minLength={12} />
					{operation.isServerSynced && !terminal ? (
						<Image
							systemName="antenna.radiowaves.left.and.right"
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle(palette.dim),
								accessibilityLabel('Following the server activity')
							]}
						/>
					) : null}
					<Text
						modifiers={[
							mono('caption'),
							foregroundStyle(tint),
							lineLimit(1),
							contentTransition('opacity'),
							...motionAwareAnimation(Motion.state, hashKey(phaseLabel(operation)), reduceMotion)
						]}
					>
						{phaseLabel(operation)}
					</Text>
				</HStack>

				<ZStack
					alignment="leading"
					modifiers={[
						frame({ maxWidth: Infinity, minHeight: 2, maxHeight: 2 }),
						onGeometryChange((size) => setRuleWidth(size.width))
					]}
				>
					<Rectangle modifiers={[foregroundStyle(palette.rule)]} />
					{operation.progressFraction !== undefined && !terminal ? (
						<Rectangle
							modifiers={[
								foregroundStyle(tint),
								frame({ width: ruleWidth * operation.progressFraction }),
								animation(swiftAnimation(Motion.gauge), operation.progressFraction)
							]}
						/>
					) : terminal ? (
						<Rectangle modifiers={[foregroundStyle(tint)]} />
					) : null}
				</ZStack>

				<ScrollView
					modifiers={[
						frame({ maxWidth: Infinity, maxHeight: Infinity }),
						defaultScrollAnchorForRole('bottom', 'sizeChanges')
					]}
				>
					<VStack
						alignment="leading"
						spacing={4}
						modifiers={[
							frame({ maxWidth: Infinity, alignment: 'leading' }),
							padding({ horizontal: 20, vertical: 14 })
						]}
					>
						{operation.lines.map((line) => (
							<LineRow key={line.id} line={line} accent={accent} />
						))}
						{!terminal ? (
							<Text
								modifiers={[
									mono('caption'),
									foregroundStyle(operation.lines.length === 0 ? palette.dim : palette.text),
									opacity(dimmed ? 0.25 : 1),
									...pulse
								]}
							>
								{operation.lines.length === 0 ? 'starting ▊' : '▊'}
							</Text>
						) : operation.lines.length === 0 ? (
							<Text modifiers={[mono('caption'), foregroundStyle(palette.dim)]}>no output</Text>
						) : null}
					</VStack>
				</ScrollView>

				<VStack spacing={8} modifiers={[padding({ horizontal: 20, top: 12, bottom: 16 })]}>
					<HStack spacing={10}>
						<Button
							onPress={() => void copyTranscript()}
							modifiers={[
								buttonStyle('plain'),
								disabled(operation.lines.length === 0),
								opacity(operation.lines.length === 0 ? 0.4 : 1),
								accessibilityLabel('Copy log to clipboard')
							]}
						>
							<Image
								systemName="doc.on.clipboard"
								modifiers={[
									font({ textStyle: 'subheadline', weight: 'semibold' }),
									foregroundStyle(palette.text),
									frame({ width: 46, height: 46 }),
									background(palette.buttonFill, shapes.circle())
								]}
							/>
						</Button>
						{!terminal ? (
							<>
								{flatButton('Cancel', systemColors.red, palette.buttonFill, onCancel)}
								{flatButton('Hide', 'white', accent, onHide)}
							</>
						) : (
							flatButton(doneLabel(status), 'white', tint, () => {
								onDone();
								onHide();
							})
						)}
					</HStack>
					{!terminal ? (
						<Text modifiers={[mono('caption2'), foregroundStyle(palette.dim)]}>
							Hiding keeps the operation running.
						</Text>
					) : null}
				</VStack>
			</VStack>
		</Host>
	);
}
