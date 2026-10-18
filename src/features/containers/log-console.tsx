import { forwardRef, memo, useImperativeHandle, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
	FlatList,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	type ListRenderItemInfo,
	type NativeScrollEvent,
	type NativeSyntheticEvent
} from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { Icon } from '@/ui/Icon';
import {
	logLineAccessibilityText,
	type LogViewerLine,
	type LogViewerSeverity
} from '@/stores/log-viewer-store';

import { LongPressMenu } from './long-press-menu';
import type { LogViewerModel } from './use-log-viewer';

const wideMinimumWidth = 640;
const bottomThreshold = 28;
const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

const messageColor: Record<LogViewerSeverity, string> = {
	error: systemColors.red,
	warning: systemColors.orange,
	debug: colors.secondaryLabel as string,
	standard: colors.label as string
};

const metadataColor = (severity: LogViewerSeverity) =>
	severity === 'error'
		? systemColors.red
		: severity === 'warning'
			? systemColors.orange
			: (colors.secondaryLabel as string);

const LogLineRow = memo(function LogLineRow({
	entry,
	showTimestamps,
	wrapLines,
	wide,
	onCopyLine
}: {
	entry: LogViewerLine;
	showTimestamps: boolean;
	wrapLines: boolean;
	wide: boolean;
	onCopyLine: (text: string) => void;
}) {
	const { line, presentation } = entry;
	const hasMetadata =
		(showTimestamps && presentation.displayTimestamp !== undefined) ||
		!!line.service ||
		presentation.levelLabel !== undefined;
	const message = (
		<Text
			style={[
				styles.message,
				{ color: messageColor[presentation.severity] as string },
				wide && wrapLines ? { flex: 1 } : null
			]}
			numberOfLines={wrapLines ? undefined : 1}
		>
			{line.text}
		</Text>
	);
	return (
		<LongPressMenu
			items={[{ id: 'copy', title: 'Copy Line', onPress: () => onCopyLine(line.text) }]}
			accessibilityLabel={logLineAccessibilityText(line, presentation, showTimestamps)}
			style={[styles.row, entry.id % 2 === 0 ? styles.striped : null]}
		>
			{wide ? (
				<View style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline' }}>
					{showTimestamps ? (
						<Text style={[styles.meta, { width: 82 }]}>{presentation.displayTimestamp ?? ''}</Text>
					) : null}
					<Text numberOfLines={1} style={[styles.meta, { width: 110 }]}>
						{line.service ?? ''}
					</Text>
					<Text style={[styles.meta, { width: 58, color: metadataColor(presentation.severity) }]}>
						{presentation.levelLabel ?? ''}
					</Text>
					{message}
				</View>
			) : (
				<View style={{ gap: 3 }}>
					{hasMetadata ? (
						<View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
							{showTimestamps && presentation.displayTimestamp ? (
								<Text style={styles.meta}>{presentation.displayTimestamp}</Text>
							) : null}
							{line.service ? (
								<View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
									<Icon name="shippingbox" size={10} color={colors.secondaryLabel} />
									<Text numberOfLines={1} style={styles.meta}>
										{line.service}
									</Text>
								</View>
							) : null}
							{presentation.levelLabel ? (
								<Text
									style={[
										styles.meta,
										{ fontWeight: '600', color: metadataColor(presentation.severity) }
									]}
								>
									{presentation.levelLabel}
								</Text>
							) : null}
						</View>
					) : null}
					{message}
				</View>
			)}
		</LongPressMenu>
	);
});

function EmptyState({ model }: { model: LogViewerModel }) {
	const accent = useAccentColor();
	const state = model.snapshot.connectionState;
	if (state.kind === 'connecting') {
		return (
			<View style={styles.empty}>
				<ArcaneLoadingView />
				<Text style={{ fontSize: 16, color: colors.secondaryLabel }}>
					Connecting to log stream…
				</Text>
			</View>
		);
	}
	const content = {
		live: {
			icon: 'text.alignleft',
			title: 'Waiting for Output',
			message: 'The stream is connected and waiting for new log lines.'
		},
		failed: {
			icon: 'wifi.exclamationmark',
			title: "Couldn't Load Logs",
			message: state.kind === 'failed' ? state.message : ''
		},
		ended: {
			icon: 'text.alignleft',
			title: 'No Log Output',
			message: 'The stream ended without returning any log lines.'
		},
		idle: {
			icon: 'wifi.slash',
			title: 'Logs Disconnected',
			message: 'Reopen the viewer or retry the connection.'
		}
	}[state.kind];
	return (
		<View style={styles.empty}>
			<Icon name={content.icon} size={44} color={colors.secondaryLabel} />
			<Text style={{ fontSize: 22, fontWeight: '700', color: colors.label, textAlign: 'center' }}>
				{content.title}
			</Text>
			<Text style={{ fontSize: 15, color: colors.secondaryLabel, textAlign: 'center' }}>
				{content.message}
			</Text>
			{state.kind === 'failed' ? (
				<Pressable
					onPress={() => model.store.retry()}
					accessibilityRole="button"
					style={{
						marginTop: 8,
						flexDirection: 'row',
						gap: 6,
						alignItems: 'center',
						backgroundColor: accent,
						borderRadius: 999,
						paddingHorizontal: 16,
						paddingVertical: 8
					}}
				>
					<Icon name="arrow.clockwise" size={15} color="#FFFFFF" />
					<Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</Text>
				</Pressable>
			) : null}
		</View>
	);
}

export type LogConsoleHandle = { jumpToLatest: () => void };

export const LogConsole = forwardRef<LogConsoleHandle, { model: LogViewerModel }>(
	function LogConsole({ model }, ref) {
		const list = useRef<FlatList<LogViewerLine>>(null);
		const safeArea = useSafeAreaInsets();
		const userIsScrolling = useRef(false);
		const [width, setWidth] = useState(0);
		const { snapshot, store, showTimestamps, wrapLines, copyLine } = model;
		const wide = width >= wideMinimumWidth;
		const renderItem = ({ item }: ListRenderItemInfo<LogViewerLine>) => (
			<LogLineRow
				entry={item}
				showTimestamps={showTimestamps}
				wrapLines={wrapLines}
				wide={wide}
				onCopyLine={copyLine}
			/>
		);

		useImperativeHandle(ref, () => ({
			jumpToLatest: () => {
				store.resumeFollowing();
				list.current?.scrollToEnd({ animated: true });
			}
		}));

		const isAtBottom = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
			return contentOffset.y + layoutMeasurement.height >= contentSize.height - bottomThreshold;
		};

		const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
			if (!userIsScrolling.current) return;
			userIsScrolling.current = false;
			if (isAtBottom(event)) store.resumeFollowing();
			else store.pauseFollowing();
		};

		const body =
			snapshot.lines.length === 0 ? (
				<EmptyState model={model} />
			) : (
				<FlatList
					ref={list}
					data={snapshot.lines}
					keyExtractor={(entry) => String(entry.id)}
					renderItem={renderItem}
					extraData={`${showTimestamps}|${wrapLines}|${wide}`}
					onScrollBeginDrag={() => {
						userIsScrolling.current = true;
					}}
					onScroll={(event) => {
						if (!userIsScrolling.current) return;
						if (isAtBottom(event)) store.resumeFollowing();
						else store.pauseFollowing();
					}}
					onScrollEndDrag={(event) => {
						if ((event.nativeEvent.velocity?.y ?? 0) === 0) settle(event);
					}}
					onMomentumScrollEnd={settle}
					onContentSizeChange={() => {
						if (store.getSnapshot().isFollowing) list.current?.scrollToEnd({ animated: false });
					}}
					scrollEventThrottle={32}
					initialNumToRender={40}
					windowSize={11}
					maxToRenderPerBatch={60}
					removeClippedSubviews
					ListFooterComponent={
						Platform.OS === 'ios' ? <View style={{ height: safeArea.bottom }} /> : undefined
					}
					style={{ flex: 1 }}
				/>
			);

		return (
			<View
				style={{ flex: 1, backgroundColor: colors.systemBackground }}
				onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			>
				{model.wrapLines || snapshot.lines.length === 0 ? (
					body
				) : (
					<ScrollView horizontal contentContainerStyle={{ minWidth: width }} style={{ flex: 1 }}>
						<View style={{ minWidth: width, flex: 1 }}>{body}</View>
					</ScrollView>
				)}
			</View>
		);
	}
);

const styles = StyleSheet.create({
	row: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.separator
	},
	striped: { backgroundColor: Platform.select({ ios: '#8E8E930F', default: '#8E8E9314' }) },
	message: { fontFamily: mono, fontSize: 12 },
	meta: { fontFamily: mono, fontSize: 11, color: colors.secondaryLabel },
	empty: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		paddingVertical: 72,
		paddingHorizontal: 32
	}
});
