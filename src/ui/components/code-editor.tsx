import { useId, useMemo, useRef, useState } from 'react';
import {
	InputAccessoryView,
	Keyboard,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
	type TextInputSelectionChangeEvent
} from 'react-native';

import { colors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';

import { useIsDark } from './accessibility';
import { monoFamily } from './type-scale';

export type CodeEditorLanguage = 'yaml' | 'env' | 'plaintext';

export type CodeEditorProps = {
	text: string;
	onChangeText?: (text: string) => void;
	language?: CodeEditorLanguage;
	readOnly?: boolean;
	height?: number;
	accessibilityLabel?: string;
};

const noop = () => {};

type RGB = [number, number, number];
const hex = ([r, g, b]: RGB) =>
	`#${[r, g, b]
		.map((v) =>
			Math.round(v * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
const adaptive = (dark: RGB, light: RGB) => ({ dark: hex(dark), light: hex(light) });

const palette = {
	key: adaptive([0.5, 0.82, 1.0], [0.05, 0.4, 0.78]),
	comment: adaptive([0.47, 0.72, 0.47], [0.2, 0.55, 0.2]),
	string: adaptive([0.98, 0.75, 0.5], [0.75, 0.35, 0.05]),
	number: adaptive([0.82, 0.65, 1.0], [0.5, 0.2, 0.8]),
	bool: adaptive([1.0, 0.6, 0.6], [0.78, 0.1, 0.1]),
	anchor: adaptive([1.0, 0.87, 0.45], [0.7, 0.5, 0.0])
};

type ColorName = keyof typeof palette;
type Rule = { pattern: RegExp; group: number; color: ColorName };

const yamlRules: Rule[] = [
	{ pattern: /^(\s*)([\w\-./]+)(?=\s*:)/gm, group: 2, color: 'key' },
	{ pattern: /'[^'\n]*'/g, group: 0, color: 'string' },
	{ pattern: /"[^"\n]*"/g, group: 0, color: 'string' },
	{ pattern: /:\s(\d+\.?\d*)\b/g, group: 1, color: 'number' },
	{ pattern: /:\s(true|false|yes|no|null|~|True|False|Yes|No|Null)\b/g, group: 1, color: 'bool' },
	{ pattern: /[&*][\w-]+/g, group: 0, color: 'anchor' },
	{ pattern: /#.*$/gm, group: 0, color: 'comment' }
];

const envRules: Rule[] = [
	{ pattern: /^[A-Z_][A-Z0-9_]*(?==)/gm, group: 0, color: 'key' },
	{ pattern: /=(.*)$/gm, group: 1, color: 'string' },
	{ pattern: /#.*$/gm, group: 0, color: 'comment' }
];

const editorFont = Platform.select({ ios: 'Menlo', default: monoFamily });

const maximumHighlightedLength = 120_000;

type Span = { text: string; color?: ColorName };

function highlight(text: string, language: CodeEditorLanguage): Span[] {
	if (language === 'plaintext' || text.length > maximumHighlightedLength) return [{ text }];
	const rules = language === 'yaml' ? yamlRules : envRules;
	const marks: (ColorName | undefined)[] = Array.from({ length: text.length });
	for (const rule of rules) {
		rule.pattern.lastIndex = 0;
		for (const match of text.matchAll(rule.pattern)) {
			const value = match[rule.group];
			if (value === undefined || value === '') continue;
			const offset = rule.group === 0 ? 0 : match[0].indexOf(value);
			const start = (match.index ?? 0) + offset;
			for (let i = start; i < start + value.length; i++) marks[i] = rule.color;
		}
	}
	const spans: Span[] = [];
	let start = 0;
	for (let i = 1; i <= text.length; i++) {
		if (i === text.length || marks[i] !== marks[start]) {
			spans.push({ text: text.slice(start, i), color: marks[start] });
			start = i;
		}
	}
	return spans;
}

type Selection = { start: number; end: number };

function autoIndent(
	previous: string,
	next: string,
	selection: Selection
): { text: string; cursor: number } | undefined {
	if (next.length !== previous.length + 1 - (selection.end - selection.start)) return undefined;
	const insertAt = selection.start;
	if (next[insertAt] !== '\n') return undefined;
	if (next.slice(0, insertAt) !== previous.slice(0, insertAt)) return undefined;
	const lineStart = previous.lastIndexOf('\n', insertAt - 1) + 1;
	const line = previous.slice(lineStart, insertAt);
	const indent = /^ */.exec(line)?.[0] ?? '';
	const trimmed = line.trim();
	const extra =
		trimmed.endsWith(':') ||
		trimmed === '-' ||
		trimmed.endsWith('|-') ||
		trimmed.endsWith('|') ||
		trimmed.endsWith('>')
			? '  '
			: '';
	if (indent === '' && extra === '') return undefined;
	const insertion = `\n${indent}${extra}`;
	return {
		text: previous.slice(0, insertAt) + insertion + previous.slice(selection.end),
		cursor: insertAt + insertion.length
	};
}

export function CodeEditor({
	text,
	onChangeText = noop,
	language = 'yaml',
	readOnly = false,
	height,
	accessibilityLabel
}: CodeEditorProps) {
	const isDark = useIsDark();
	const accessoryID = useId();
	const selectionRef = useRef<Selection>({ start: 0, end: 0 });
	const [pendingSelection, setPendingSelection] = useState<Selection>();
	const [focused, setFocused] = useState(false);
	const spans = useMemo(() => highlight(text, language), [text, language]);

	const replaceSelection = (insertion: string, cursorOffset = insertion.length) => {
		const { start, end } = selectionRef.current;
		const next = text.slice(0, start) + insertion + text.slice(end);
		const cursor = start + cursorOffset;
		selectionRef.current = { start: cursor, end: cursor };
		setPendingSelection({ start: cursor, end: cursor });
		onChangeText(next);
	};

	const keys: { label: string; action: () => void }[] = (() => {
		const quotes = { label: '“”', action: () => replaceSelection('""', 1) };
		const hash = { label: '#', action: () => replaceSelection('# ') };
		switch (language) {
			case 'yaml':
				return [
					{ label: '⇥', action: () => replaceSelection('  ') },
					{
						label: '⇤',
						action: () => {
							const { start } = selectionRef.current;
							const lineStart = text.lastIndexOf('\n', start - 1) + 1;
							if (!text.startsWith('  ', lineStart)) return;
							const next = text.slice(0, lineStart) + text.slice(lineStart + 2);
							const cursor = Math.max(start - 2, lineStart);
							selectionRef.current = { start: cursor, end: cursor };
							setPendingSelection({ start: cursor, end: cursor });
							onChangeText(next);
						}
					},
					{ label: ':', action: () => replaceSelection(': ') },
					{
						label: '-',
						action: () => {
							const { start } = selectionRef.current;
							const lineStart = text.lastIndexOf('\n', start - 1) + 1;
							const lineText = text.slice(lineStart, start);
							const indent = /^ */.exec(lineText)?.[0] ?? '';
							replaceSelection(lineText.trim() === '' ? '- ' : `\n${indent}- `);
						}
					},
					{ label: '|', action: () => replaceSelection(' |') },
					quotes,
					hash
				];
			case 'env':
				return [{ label: '=', action: () => replaceSelection('=') }, quotes, hash];
			case 'plaintext':
				return [quotes, hash];
		}
	})();

	const quickKeys = (
		<View
			style={{
				height: 48,
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.secondarySystemBackground
			}}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				keyboardShouldPersistTaps="always"
				contentContainerStyle={{ gap: 8, paddingHorizontal: 10 }}
			>
				{keys.map((key) => (
					<Pressable
						key={key.label}
						onPress={key.action}
						accessibilityRole="button"
						accessibilityLabel={key.label}
						style={{
							minWidth: 44,
							minHeight: 34,
							alignItems: 'center',
							justifyContent: 'center',
							paddingHorizontal: 8,
							borderRadius: Radius.nested,
							borderCurve: 'continuous',
							backgroundColor: '#7676801F'
						}}
					>
						<Text
							style={{
								fontFamily: editorFont,
								fontSize: 16,
								fontWeight: '500',
								color: colors.label
							}}
						>
							{key.label}
						</Text>
					</Pressable>
				))}
			</ScrollView>
			<Pressable
				onPress={() => Keyboard.dismiss()}
				accessibilityRole="button"
				accessibilityLabel="Dismiss Keyboard"
				style={{
					width: 44,
					height: 34,
					alignItems: 'center',
					justifyContent: 'center',
					marginRight: 8
				}}
			>
				<Icon name="keyboard.chevron.compact.down" size={18} color={colors.secondaryLabel} />
			</Pressable>
		</View>
	);

	return (
		<View style={height !== undefined ? { height } : { flex: 1 }}>
			<TextInput
				multiline
				editable={!readOnly}
				autoCapitalize="none"
				autoCorrect={false}
				spellCheck={false}
				smartInsertDelete={false}
				autoComplete="off"
				textAlignVertical="top"
				scrollEnabled
				accessibilityLabel={accessibilityLabel}
				inputAccessoryViewID={Platform.OS === 'ios' && !readOnly ? accessoryID : undefined}
				selection={pendingSelection}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onSelectionChange={(event: TextInputSelectionChangeEvent) => {
					selectionRef.current = event.nativeEvent.selection;
					if (pendingSelection) setPendingSelection(undefined);
				}}
				onChangeText={(next) => {
					if (language === 'yaml') {
						const indented = autoIndent(text, next, selectionRef.current);
						if (indented) {
							selectionRef.current = { start: indented.cursor, end: indented.cursor };
							setPendingSelection({ start: indented.cursor, end: indented.cursor });
							onChangeText(indented.text);
							return;
						}
					}
					onChangeText(next);
				}}
				style={{
					flex: 1,
					fontFamily: editorFont,
					fontSize: 13.5,
					color: colors.label,
					paddingTop: 12,
					paddingLeft: Platform.OS === 'ios' ? 13 : 8,
					paddingRight: Platform.OS === 'ios' ? 13 : 8,
					paddingBottom: 32
				}}
			>
				<Text>
					{spans.map((span, index) => (
						<Text
							key={index}
							style={
								span.color ? { color: palette[span.color][isDark ? 'dark' : 'light'] } : undefined
							}
						>
							{span.text}
						</Text>
					))}
				</Text>
			</TextInput>
			{Platform.OS === 'ios' && !readOnly ? (
				<InputAccessoryView nativeID={accessoryID}>{quickKeys}</InputAccessoryView>
			) : null}
			{Platform.OS === 'android' && focused && !readOnly ? quickKeys : null}
		</View>
	);
}
