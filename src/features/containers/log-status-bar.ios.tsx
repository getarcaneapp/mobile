import { Host } from '@/ui/host';
import {
	Button,
	Circle,
	Divider,
	HStack,
	Label,
	Menu,
	ProgressView,
	Spacer,
	Text,
	Toggle
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHint,
	accessibilityLabel,
	background,
	buttonBorderShape,
	buttonStyle,
	contentTransition,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	labelStyle,
	lineLimit,
	monospacedDigit,
	padding,
	tint
} from '@expo/ui/swift-ui/modifiers';

import { colors, systemColors } from '@/theme/colors';
import { useAccentColor } from '@/theme/accent';
import { DestructiveLabel } from '@/ui/components/labels';

import type { LogViewerModel } from './use-log-viewer';

function ConnectionIndicator({ kind }: { kind: string }) {
	switch (kind) {
		case 'connecting':
			return <ProgressView modifiers={[controlSize('small'), accessibilityLabel('Connecting')]} />;
		case 'live':
			return (
				<Circle
					modifiers={[
						foregroundStyle(systemColors.green),
						frame({ width: 8, height: 8 }),
						accessibilityLabel('Live')
					]}
				/>
			);
		case 'failed':
			return (
				<Image
					systemName="exclamationmark.triangle.fill"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle(systemColors.red),
						accessibilityLabel('Connection failed')
					]}
				/>
			);
		case 'ended':
			return (
				<Image
					systemName="stop.circle.fill"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						accessibilityLabel('Stream ended')
					]}
				/>
			);
		default:
			return (
				<Circle
					modifiers={[
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						frame({ width: 8, height: 8 }),
						accessibilityLabel('Disconnected')
					]}
				/>
			);
	}
}

function OptionsMenuItems({ model }: { model: LogViewerModel }) {
	const empty = model.snapshot.lines.length === 0;
	return (
		<>
			<Toggle
				label="Timestamps"
				systemImage="clock"
				isOn={model.showTimestamps}
				onIsOnChange={model.setShowTimestamps}
			/>
			<Toggle
				label="Wrap Lines"
				systemImage="text.justify.left"
				isOn={model.wrapLines}
				onIsOnChange={model.setWrapLines}
			/>
			<Divider />
			<Button
				label="Copy All"
				systemImage="doc.on.doc"
				onPress={model.copyLogs}
				modifiers={[disabled(empty)]}
			/>
			<Button
				label="Share All…"
				systemImage="square.and.arrow.up"
				onPress={model.shareLogs}
				modifiers={[disabled(empty)]}
			/>
			<Divider />
			<Button
				role="destructive"
				onPress={() => model.store.clear()}
				modifiers={[tint(systemColors.red), disabled(empty)]}
			>
				<DestructiveLabel text="Clear" />
			</Button>
		</>
	);
}

export function LogStatusBar({
	model,
	embedded,
	onExpand,
	onJumpToLatest
}: {
	model: LogViewerModel;
	embedded: boolean;
	onExpand?: () => void;
	onJumpToLatest: () => void;
}) {
	const accent = useAccentColor();
	const { snapshot } = model;
	const newLines = snapshot.newLinesWhilePaused;
	return (
		<Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
			<HStack
				spacing={8}
				modifiers={[
					padding({ horizontal: 12, vertical: 6 }),
					frame({ maxWidth: Infinity }),
					background(colors.secondarySystemBackground as string),
					accessibilityLabel('Log stream controls')
				]}
			>
				<ConnectionIndicator kind={snapshot.connectionState.kind} />
				<Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), lineLimit(1)]}>
					{model.statusLabel}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						monospacedDigit(),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{model.countLabel}
				</Text>
				{!snapshot.isFollowing ? (
					<Button
						onPress={onJumpToLatest}
						modifiers={[
							buttonStyle('borderedProminent'),
							buttonBorderShape('capsule'),
							controlSize('small'),
							tint(accent),
							accessibilityLabel(
								newLines > 0 ? `${newLines} new log lines` : 'Resume following log lines'
							),
							accessibilityHint('Jumps to the latest log line')
						]}
					>
						<Label
							title={newLines > 0 ? `${newLines} new` : 'Latest'}
							systemImage="arrow.down"
							modifiers={[
								font({ textStyle: 'caption', weight: 'bold' }),
								monospacedDigit(),
								contentTransition('numericText')
							]}
						/>
					</Button>
				) : null}
				<Spacer minLength={8} />
				{snapshot.connectionState.kind === 'failed' ? (
					<Button
						label="Retry"
						systemImage="arrow.clockwise"
						onPress={() => model.store.retry()}
						modifiers={[
							labelStyle('iconOnly'),
							buttonStyle('bordered'),
							buttonBorderShape('circle'),
							controlSize('small'),
							accessibilityHint('Reconnects without clearing received logs')
						]}
					/>
				) : null}
				{embedded ? (
					<>
						<Button
							systemImage="arrow.up.left.and.arrow.down.right"
							onPress={onExpand}
							modifiers={[
								buttonStyle('bordered'),
								buttonBorderShape('circle'),
								controlSize('small'),
								labelStyle('iconOnly'),
								accessibilityLabel('Expand logs')
							]}
							label="Expand logs"
						/>
						<Menu
							label={<Image systemName="ellipsis.circle" modifiers={[foregroundStyle(accent)]} />}
							modifiers={[
								buttonStyle('bordered'),
								buttonBorderShape('circle'),
								controlSize('small'),
								accessibilityLabel('Log options')
							]}
						>
							<OptionsMenuItems model={model} />
						</Menu>
					</>
				) : null}
			</HStack>
		</Host>
	);
}
