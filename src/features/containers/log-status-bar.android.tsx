import { MenuView } from '@react-native-menu/menu';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import type { LogViewerModel } from './use-log-viewer';

function ConnectionIndicator({ kind }: { kind: string }) {
	switch (kind) {
		case 'connecting':
			return <ActivityIndicator size="small" accessibilityLabel="Connecting" />;
		case 'live':
			return (
				<View
					accessibilityLabel="Live"
					style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: systemColors.green }}
				/>
			);
		case 'failed':
			return (
				<Icon
					name="exclamationmark.triangle.fill"
					size={14}
					color={systemColors.red}
					accessibilityLabel="Connection failed"
				/>
			);
		case 'ended':
			return (
				<Icon
					name="stop.circle.fill"
					size={14}
					color={colors.secondaryLabel}
					accessibilityLabel="Stream ended"
				/>
			);
		default:
			return (
				<View
					accessibilityLabel="Disconnected"
					style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondaryLabel }}
				/>
			);
	}
}

function IconButton({
	icon,
	label,
	onPress
}: {
	icon: string;
	label: string;
	onPress?: () => void;
}) {
	if (!onPress) {
		return (
			<View
				accessibilityLabel={label}
				style={{
					width: 32,
					height: 32,
					borderRadius: 16,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: m3.surfaceContainerHighest
				}}
			>
				<Icon name={icon} size={16} color={m3.onSurfaceVariant} />
			</View>
		);
	}
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			android_ripple={{ color: colors.separator as string, borderless: true }}
			style={{
				width: 32,
				height: 32,
				borderRadius: 16,
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: m3.surfaceContainerHighest
			}}
		>
			<Icon name={icon} size={16} color={m3.onSurfaceVariant} />
		</Pressable>
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
	const { snapshot } = model;
	const newLines = snapshot.newLinesWhilePaused;
	const empty = snapshot.lines.length === 0;
	return (
		<View
			accessibilityLabel="Log stream controls"
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				paddingHorizontal: 12,
				paddingVertical: 6,
				backgroundColor: colors.secondarySystemBackground
			}}
		>
			<ConnectionIndicator kind={snapshot.connectionState.kind} />
			<Text numberOfLines={1} style={[m3Type.labelMedium, { color: colors.label }]}>
				{model.statusLabel}
			</Text>
			<Text
				numberOfLines={1}
				style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }]}
			>
				{model.countLabel}
			</Text>
			{!snapshot.isFollowing ? (
				<Pressable
					onPress={onJumpToLatest}
					accessibilityRole="button"
					accessibilityLabel={
						newLines > 0 ? `${newLines} new log lines` : 'Resume following log lines'
					}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 4,
						backgroundColor: m3.primary,
						borderRadius: 999,
						paddingHorizontal: 10,
						paddingVertical: 4
					}}
				>
					<Icon name="arrow.down" size={12} color={m3.onPrimary} />
					<Text style={[m3Type.labelMedium, { color: m3.onPrimary }]}>
						{newLines > 0 ? `${newLines} new` : 'Latest'}
					</Text>
				</Pressable>
			) : null}
			<View style={{ flex: 1, minWidth: 8 }} />
			{snapshot.connectionState.kind === 'failed' ? (
				<IconButton icon="arrow.clockwise" label="Retry" onPress={() => model.store.retry()} />
			) : null}
			{embedded ? (
				<>
					<IconButton
						icon="arrow.up.left.and.arrow.down.right"
						label="Expand logs"
						onPress={onExpand}
					/>
					<MenuView
						actions={[
							{ id: 'timestamps', title: 'Timestamps', state: model.showTimestamps ? 'on' : 'off' },
							{ id: 'wrap', title: 'Wrap Lines', state: model.wrapLines ? 'on' : 'off' },
							{ id: 'copy', title: 'Copy All', attributes: { disabled: empty } },
							{ id: 'share', title: 'Share All…', attributes: { disabled: empty } },
							{ id: 'clear', title: 'Clear', attributes: { destructive: true, disabled: empty } }
						]}
						onPressAction={({ nativeEvent }) => {
							switch (nativeEvent.event) {
								case 'timestamps':
									return model.setShowTimestamps(!model.showTimestamps);
								case 'wrap':
									return model.setWrapLines(!model.wrapLines);
								case 'copy':
									return model.copyLogs();
								case 'share':
									return model.shareLogs();
								case 'clear':
									return model.store.clear();
							}
						}}
					>
						<IconButton icon="ellipsis.circle" label="Log options" />
					</MenuView>
				</>
			) : null}
		</View>
	);
}
