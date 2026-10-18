import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { memo, useRef, useState, type ComponentRef } from 'react';
import {
	Dimensions,
	FlatList,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
	type ListRenderItemInfo,
	type NativeScrollEvent,
	type NativeSyntheticEvent
} from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccentColor } from '@/theme/accent';
import { colors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

import { AndroidToolbar } from './android-toolbar';
import { lightHaptic } from './container-actions';
import { StandaloneErrorBanner } from './standalone-error-banner';
import type { TerminalOutputLine } from '@/core/terminal-output-processor';

import { terminalShells, useContainerTerminal } from './use-container-terminal';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

const shortcuts: { label: string; sequence: string }[] = [
	{ label: 'Tab', sequence: '\t' },
	{ label: 'Esc', sequence: '\u001b' },
	{ label: 'Ctrl+C', sequence: '\u0003' },
	{ label: 'Ctrl+D', sequence: '\u0004' },
	{ label: '↑', sequence: '\u001b[A' },
	{ label: '↓', sequence: '\u001b[B' }
];

const TerminalLine = memo(function TerminalLine({ text }: { text: string }) {
	return (
		<Text selectable style={styles.line}>
			{text === '' ? ' ' : text}
		</Text>
	);
});

const renderTerminalLine = ({ item }: ListRenderItemInfo<TerminalOutputLine>) => (
	<TerminalLine text={item.text} />
);

const terminalLineKey = (line: TerminalOutputLine) => String(line.id);

export function ContainerTerminalScreen() {
	const router = useRouter();
	const accent = useAccentColor();
	const insets = useSafeAreaInsets();
	const {
		id = '',
		envID = '0',
		title = ''
	} = useLocalSearchParams<{ id?: string; envID?: string; title?: string }>();
	const terminal = useContainerTerminal(envID, id);
	const [input, setInput] = useState('');
	const list = useRef<FlatList<TerminalOutputLine>>(null);
	const userIsScrolling = useRef(false);

	const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0));
	const root = useRef<ComponentRef<typeof View>>(null);
	const [bottomGap, setBottomGap] = useState(0);
	const measureBottomGap = () =>
		root.current?.measureInWindow((_x: number, y: number, _width: number, height: number) =>
			setBottomGap(Math.max(0, Dimensions.get('screen').height - (y + height)))
		);
	const homeIndicatorPadding = Math.max(0, insets.bottom - bottomGap);

	const close = () => {
		void terminal.teardown().then(() => router.back());
	};

	const sendInput = () => {
		if (!terminal.isConnected) return;
		terminal.send(`${input}\n`);
		setInput('');
	};

	const observe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
		terminal.follow.observe(
			contentOffset.y + layoutMeasurement.height >= contentSize.height - 28,
			userIsScrolling.current
		);
	};

	return (
		<>
			<Stack.Screen options={{ title }} />
			{Platform.OS === 'android' ? (
				<>
					<AndroidToolbar
						placement="left"
						items={[{ kind: 'button', id: 'close', icon: 'xmark', label: 'Close', onPress: close }]}
					/>
					<AndroidToolbar
						items={[
							{
								kind: 'menu',
								id: 'options',
								icon: 'terminal',
								label: 'Terminal options',
								items: [
									...terminalShells.map((shell) => ({
										id: shell,
										title: shell,
										selected: terminal.shell === shell,
										onPress: () => terminal.selectShell(shell)
									})),
									{
										id: 'copy',
										title: 'Copy All',
										disabled: terminal.outputLines.length === 0,
										onPress: () => void terminal.copyAllOutput()
									},
									{
										id: 'clear',
										title: 'Clear Output',
										destructive: true,
										onPress: terminal.clearOutput
									}
								]
							}
						]}
					/>
				</>
			) : (
				<>
					<AppToolbar placement="left" tintColor={accent}>
						<Stack.Toolbar.Button
							onPress={() => {
								void terminal.teardown().then(() => router.back());
							}}
						>
							Close
						</Stack.Toolbar.Button>
					</AppToolbar>
					<AppToolbar placement="right" tintColor={accent}>
						<Stack.Toolbar.Menu icon="terminal" accessibilityLabel="Terminal options">
							<Stack.Toolbar.Menu inline title="Shell">
								{terminalShells.map((shell) => (
									<Stack.Toolbar.MenuAction
										key={shell}
										isOn={terminal.shell === shell}
										onPress={() => terminal.selectShell(shell)}
									>
										{shell}
									</Stack.Toolbar.MenuAction>
								))}
							</Stack.Toolbar.Menu>
							<Stack.Toolbar.MenuAction
								icon="doc.on.doc"
								disabled={terminal.outputLines.length === 0}
								onPress={() => void terminal.copyAllOutput()}
							>
								Copy All
							</Stack.Toolbar.MenuAction>
							<Stack.Toolbar.MenuAction icon="trash" destructive onPress={terminal.clearOutput}>
								Clear Output
							</Stack.Toolbar.MenuAction>
						</Stack.Toolbar.Menu>
					</AppToolbar>
				</>
			)}
			<View
				ref={root}
				onLayout={measureBottomGap}
				style={{ flex: 1, backgroundColor: colors.systemBackground }}
			>
				{terminal.connectError ? (
					<View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
						<StandaloneErrorBanner
							message={terminal.connectError}
							severity="warning"
							retry={terminal.connect}
						/>
					</View>
				) : null}
				<FlatList
					ref={list}
					data={terminal.outputLines}
					keyExtractor={terminalLineKey}
					renderItem={renderTerminalLine}
					initialNumToRender={40}
					maxToRenderPerBatch={60}
					windowSize={11}
					ListEmptyComponent={
						<Text
							style={[styles.line, { color: colors.secondaryLabel }]}
						>{`Connecting to ${terminal.shell}…`}</Text>
					}
					contentContainerStyle={{
						padding: 12,
						paddingBottom: 12 + Math.max(0, keyboardHeight - bottomGap - homeIndicatorPadding)
					}}
					style={{ flex: 1 }}
					onScrollBeginDrag={() => {
						userIsScrolling.current = true;
					}}
					onMomentumScrollEnd={() => {
						userIsScrolling.current = false;
					}}
					onScrollEndDrag={(event) => {
						if ((event.nativeEvent.velocity?.y ?? 0) === 0) userIsScrolling.current = false;
					}}
					onScroll={observe}
					scrollEventThrottle={32}
					onContentSizeChange={() => {
						if (terminal.follow.isFollowing) list.current?.scrollToEnd({ animated: false });
					}}
				/>
				<KeyboardStickyView offset={{ closed: 0, opened: bottomGap + homeIndicatorPadding }}>
					<View style={[styles.inputBar, { paddingBottom: 6 + homeIndicatorPadding }]}>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
						>
							{shortcuts.map((shortcut) => (
								<Pressable
									key={shortcut.label}
									disabled={!terminal.isConnected}
									onPress={() => {
										lightHaptic();
										terminal.send(shortcut.sequence);
									}}
									accessibilityRole="button"
									style={[styles.shortcut, { opacity: terminal.isConnected ? 1 : 0.5 }]}
								>
									<Text style={{ fontFamily: mono, fontSize: 12, color: colors.label }}>
										{shortcut.label}
									</Text>
								</Pressable>
							))}
						</ScrollView>
						<View style={styles.field}>
							<Text
								style={{
									fontFamily: mono,
									fontWeight: '700',
									fontSize: 17,
									color: colors.secondaryLabel
								}}
							>
								$
							</Text>
							<TextInput
								value={input}
								onChangeText={setInput}
								placeholder="command"
								placeholderTextColor={colors.tertiaryLabel}
								autoCapitalize="none"
								autoCorrect={false}
								autoFocus
								returnKeyType="send"
								submitBehavior="submit"
								onSubmitEditing={sendInput}
								style={{
									flex: 1,
									fontFamily: mono,
									fontSize: 17,
									color: colors.label,
									paddingVertical: 0
								}}
							/>
							<Pressable
								onPress={sendInput}
								disabled={!terminal.isConnected || input === ''}
								accessibilityRole="button"
								accessibilityLabel="Send"
							>
								<Icon
									name="arrow.up.circle.fill"
									size={26}
									color={input === '' || !terminal.isConnected ? colors.secondaryLabel : accent}
								/>
							</Pressable>
						</View>
					</View>
				</KeyboardStickyView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	line: { fontFamily: mono, fontSize: 12, color: colors.label },
	inputBar: {
		gap: 10,
		paddingHorizontal: 12,
		paddingTop: 10,
		backgroundColor: colors.secondarySystemBackground,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.separator
	},
	shortcut: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 999,
		backgroundColor: colors.tertiarySystemGroupedBackground
	},
	field: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: Radius.nested,
		borderCurve: 'continuous',
		backgroundColor: colors.tertiarySystemGroupedBackground
	}
});
