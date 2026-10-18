import {
	BottomSheet,
	Button,
	ContextMenu,
	Divider,
	HStack,
	Label,
	LabeledContent,
	List,
	Menu,
	NavigationLink,
	Picker,
	SecureField,
	Section,
	SwipeActions,
	Text,
	TextField,
	VStack,
	useNativeState
} from '@expo/ui/swift-ui';
import {
	accessibilityLabel,
	autocorrectionDisabled,
	disabled as disabledModifier,
	font,
	foregroundStyle,
	keyboardType,
	multilineTextAlignment,
	pickerStyle,
	textFieldStyle,
	textInputAutocapitalization,
	tint,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import {
	Children,
	isValidElement,
	useEffect,
	useRef,
	type ComponentProps,
	type ReactElement,
	type ReactNode
} from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors } from '@/theme/colors';
import { DestructiveLabel } from '@/ui/components/labels';
import { Image } from '@/ui/components/swiftui-image';
import { symbolRenderingMode } from '../../../../modules/arcane-swiftui-extras';

import { encodeComposeDestination, type ComposeDestination } from '../compose-destinations';
import type { ComposeMenuAction } from '../compose-session';

export const secondaryStyle = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
export const tertiaryStyle = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });
export const plainTextInput: ModifierConfig[] = [
	textInputAutocapitalization('never'),
	autocorrectionDisabled(true)
];

export function ErrorText({ error, caption = false }: { error?: string; caption?: boolean }) {
	if (error === undefined) return null;
	return (
		<Text
			modifiers={[
				...(caption ? [font({ textStyle: 'caption' })] : []),
				foregroundStyle(systemColors.red)
			]}
		>
			{error}
		</Text>
	);
}

export function BoundField({
	placeholder,
	value,
	onChange,
	axis,
	secure = false,
	modifiers = []
}: {
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	axis?: 'horizontal' | 'vertical';
	secure?: boolean;
	modifiers?: ModifierConfig[];
}) {
	const state = useNativeState(value);
	const pending = useRef<string[]>([]);
	useEffect(() => {
		const index = pending.current.indexOf(value);
		if (index !== -1) {
			pending.current = pending.current.slice(index + 1);
			return;
		}
		pending.current = [];
		if (state.get() !== value) state.set(value);
	}, [state, value]);
	const emit = (next: string) => {
		pending.current.push(next);
		if (pending.current.length > 64) pending.current.shift();
		onChange(next);
	};
	if (secure) {
		return (
			<SecureBoundField
				state={state}
				placeholder={placeholder}
				onChange={emit}
				modifiers={modifiers}
			/>
		);
	}
	return (
		<TextField
			text={state}
			placeholder={placeholder}
			axis={axis}
			onTextChange={emit}
			modifiers={[...plainTextInput, ...modifiers]}
		/>
	);
}

function SecureBoundField({
	state,
	placeholder,
	onChange,
	modifiers
}: {
	state: ReturnType<typeof useNativeState<string>>;
	placeholder: string;
	onChange: (value: string) => void;
	modifiers: ModifierConfig[];
}) {
	return (
		<SecureField
			text={state}
			placeholder={placeholder}
			onTextChange={onChange}
			modifiers={modifiers}
		/>
	);
}

export function TrailingField({
	title,
	placeholder,
	value,
	onChange,
	number = false,
	disabled = false,
	extra = []
}: {
	title: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	number?: boolean;
	disabled?: boolean;
	extra?: ModifierConfig[];
}) {
	return (
		<LabeledContent label={title}>
			<BoundField
				placeholder={placeholder ?? title}
				value={value}
				onChange={onChange}
				modifiers={[
					textFieldStyle('plain'),
					multilineTextAlignment('trailing'),
					foregroundStyle(disabled ? 'secondary' : 'primary'),
					...(number ? [keyboardType('numbers-and-punctuation')] : []),
					...(disabled ? [disabledModifier(true)] : []),
					...extra
				]}
			/>
		</LabeledContent>
	);
}

export function ComposeLink({
	destination,
	children,
	modifiers
}: {
	destination: ComposeDestination;
	children: ReactNode;
	modifiers?: ModifierConfig[];
}) {
	return (
		<NavigationLink value={encodeComposeDestination(destination)} modifiers={modifiers}>
			{children}
		</NavigationLink>
	);
}

export function TitleLink({
	title,
	destination
}: {
	title: string;
	destination: ComposeDestination;
}) {
	return (
		<ComposeLink destination={destination}>
			<Text>{title}</Text>
		</ComposeLink>
	);
}

export function DynamicLinkRow({
	title,
	subtitle,
	systemImage,
	destination
}: {
	title: string;
	subtitle: string;
	systemImage: string;
	destination: ComposeDestination;
}) {
	return (
		<ComposeLink destination={destination}>
			<Label
				icon={
					<Image
						systemName={systemImage as SFSymbol}
						modifiers={[
							symbolRenderingMode('hierarchical'),
							foregroundStyle({ type: 'hierarchical', style: 'primary' })
						]}
					/>
				}
			>
				<VStack alignment="leading" spacing={2}>
					<Text>{title}</Text>
					<Text modifiers={[font({ textStyle: 'subheadline' }), secondaryStyle]}>{subtitle}</Text>
				</VStack>
			</Label>
		</ComposeLink>
	);
}

export function MenuActionItems({ actions }: { actions?: ComposeMenuAction[] }) {
	if (!actions) return null;
	return (
		<>
			{actions.map((action) => (
				<MenuActionItem key={action.id} action={action} />
			))}
		</>
	);
}
function MenuActionItem({ action }: { action: ComposeMenuAction }) {
	return (
		<>
			{action.dividerBefore ? <Divider /> : null}
			<Button
				label={action.title}
				systemImage={action.systemImage as SFSymbol}
				onPress={action.onPress}
				modifiers={[disabledModifier(action.disabled ?? false)]}
			/>
		</>
	);
}

export function EllipsisMenu({
	label,
	children,
	modifiers = []
}: {
	label: string;
	children: ReactNode;
	modifiers?: ModifierConfig[];
}) {
	return (
		<Menu
			label={<Image systemName="ellipsis" />}
			modifiers={[accessibilityLabel(label), ...modifiers]}
		>
			{children}
		</Menu>
	);
}

export function Sheet({
	isPresented,
	onDismiss,
	children
}: {
	isPresented: boolean;
	onDismiss: () => void;
	children: ReactNode;
}) {
	return (
		<BottomSheet
			isPresented={isPresented}
			onIsPresentedChange={(presented) => {
				if (!presented) onDismiss();
			}}
		>
			{children}
		</BottomSheet>
	);
}

export const SecondaryText = ({ children }: { children: string }) => (
	<Text modifiers={[secondaryStyle]}>{children}</Text>
);

export function ValueRow({ title, value }: { title: string; value: string }) {
	return (
		<LabeledContent label={title}>
			<Text modifiers={[secondaryStyle]}>{value}</Text>
		</LabeledContent>
	);
}

export const chevron = () => (
	<Image
		systemName="chevron.right"
		modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), tertiaryStyle]}
	/>
);

export { HStack };

export function MenuPicker<T extends string>(props: ComponentProps<typeof Picker<T>>) {
	return <Picker {...props} modifiers={[pickerStyle('menu'), ...(props.modifiers ?? [])]} />;
}

export function RowsForEach({
	onDelete,
	children
}: {
	onDelete?: (indices: number[]) => void;
	children: ReactNode;
}) {
	const rows = Children.toArray(children).filter(isValidElement);
	return (
		<List.ForEach
			data={rows}
			keyExtractor={(row, index) => String(row.key ?? index)}
			onDelete={onDelete}
		>
			{({ item }) => item}
		</List.ForEach>
	);
}

export function DeletableSection({
	title,
	readOnly,
	onDelete,
	children
}: {
	title: string;
	readOnly: boolean;
	onDelete: () => void;
	children: ReactElement;
}) {
	if (readOnly) return <Section title={title}>{children}</Section>;
	return (
		<Section title={title}>
			<SwipeActions>
				<ContextMenu>
					<ContextMenu.Trigger>{children}</ContextMenu.Trigger>
					<ContextMenu.Items>
						<Button role="destructive" onPress={onDelete} modifiers={[tint(systemColors.red)]}>
							<DestructiveLabel text="Delete" />
						</Button>
					</ContextMenu.Items>
				</ContextMenu>
				<SwipeActions.Actions edge="trailing">
					<Button
						role="destructive"
						label="Delete"
						systemImage="trash"
						onPress={onDelete}
						modifiers={[tint(systemColors.red)]}
					/>
				</SwipeActions.Actions>
			</SwipeActions>
		</Section>
	);
}
