import { Stack } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { M3Section, SwitchRow, ValueRow } from '@/features/containers/android-material';
import {
	AndroidToolbar,
	type AndroidMenuItem,
	type AndroidToolbarItem
} from '@/features/containers/android-toolbar';
import { LongPressMenu } from '@/features/containers/long-press-menu';
import { colors, systemColors } from '@/theme/colors';
import { CodeEditor } from '@/ui/components/code-editor';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type } from '@/ui/components/type-scale';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { Icon } from '@/ui/Icon';

import {
	addingAttachment,
	addingMappingEntry,
	addingResource,
	addingStringValue,
	attachmentNames,
	attempt,
	booleanFieldState,
	collectionItems,
	collectionNativeFallback,
	decodedItem,
	editsInline,
	entryName,
	fieldNames,
	mappingNativeFallback,
	parseError,
	policyOptions,
	projectResourceKeys,
	removingAttachments,
	removingEnvEntries,
	removingItems,
	removingKeys,
	removingNativeFields,
	removingResources,
	removingServices,
	resourceSummary,
	savingCollectionEntry,
	savingNativeField,
	scalarFieldState,
	serviceImage,
	ServiceFormModel,
	settingBoolean,
	settingEnvValue,
	settingPolicy,
	settingScalar,
	stringListNeedsNativeFields,
	validName,
	type EntrySelection
} from './compose-actions';
import {
	ChoiceRow,
	Divider,
	EmptyRow,
	ErrorText,
	FullScreenDialog,
	InlineInput,
	NavRow,
	ripple,
	SecondaryText,
	TextAction
} from './compose-android-kit';
import { nativeFieldsDestination, type ComposeDestination } from './compose-destinations';
import {
	useComposeBinding,
	useComposeMenuActions,
	withTransform,
	type ComposeBinding,
	type ComposeBindingRef
} from './compose-session';
import {
	AddFieldsSheet,
	EntrySheet,
	NameSheet,
	NativeValueSheet,
	ResourcePicker,
	ValuePicker
} from './compose-sheets-android';
import { ComposeDocument } from './model/compose-document';
import { ComposeDisplayText } from './model/compose-display-text';
import { composeErrorMessage } from './model/compose-errors';
import { ComposeFieldOptions } from './model/compose-field-options';
import {
	keyPath,
	nativeKindTitle,
	pathID,
	type ComposeFieldPathComponent,
	type ComposeNativeField,
	type ComposeNativeKind
} from './model/compose-native-field';
import { EnvDocument } from './model/env-document';
import type { AddFieldsOptions } from './use-add-fields';

type Push = (destination: ComposeDestination) => void;

export type ComposeNavigation = {
	push: Push;
	mode: 'route' | 'dialog' | 'embedded';
	back?: () => void;
	setChromeItems?: (items: AndroidToolbarItem[]) => void;
};
export const ComposeNavigationContext = createContext<ComposeNavigation>({
	push: () => {},
	mode: 'route'
});

const chromeSignature = (items: AndroidToolbarItem[]) =>
	JSON.stringify(
		items.map((item) =>
			item.kind === 'menu'
				? [item.id, item.items.map((entry) => [entry.id, entry.title, entry.disabled ?? false])]
				: [item.id, item.kind === 'button' ? (item.disabled ?? false) : null]
		)
	);

function usePush() {
	return useContext(ComposeNavigationContext).push;
}

function ScreenChrome({ title, items = [] }: { title: string; items?: AndroidToolbarItem[] }) {
	const { mode, back, setChromeItems } = useContext(ComposeNavigationContext);
	const latest = useRef(items);
	latest.current = items;
	const signature = chromeSignature(items);
	useEffect(() => {
		if (mode !== 'embedded' || !setChromeItems) return;
		setChromeItems(
			latest.current.map((item) =>
				item.kind === 'menu'
					? {
							...item,
							items: item.items.map((entry, index) => ({
								...entry,
								onPress: () =>
									(latest.current.find((i) => i.id === item.id) as typeof item | undefined)?.items[
										index
									]?.onPress()
							}))
						}
					: item.kind === 'button'
						? {
								...item,
								onPress: () =>
									(
										latest.current.find((i) => i.id === item.id) as typeof item | undefined
									)?.onPress()
							}
						: item
			)
		);
	}, [mode, setChromeItems, signature]);
	useEffect(() => () => setChromeItems?.([]), [setChromeItems]);
	if (mode === 'embedded') return null;
	if (mode === 'route') {
		return (
			<>
				<Stack.Screen options={{ title }} />
				{items.length > 0 ? <AndroidToolbar items={items} /> : null}
			</>
		);
	}
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				minHeight: 56,
				paddingHorizontal: 4,
				backgroundColor: colors.systemBackground
			}}
		>
			{back ? (
				<Pressable
					onPress={back}
					accessibilityRole="button"
					accessibilityLabel="Back"
					style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
				>
					<Icon name="chevron.left" size={24} color={m3.onSurfaceVariant} />
				</Pressable>
			) : null}
			<Text
				style={[m3Type.titleMedium, { color: colors.label, flex: 1, marginLeft: back ? 0 : 12 }]}
				numberOfLines={1}
			>
				{title}
			</Text>
			{items.map((item) =>
				item.kind === 'button' ? (
					<Pressable
						key={item.id}
						onPress={item.onPress}
						disabled={item.disabled}
						accessibilityLabel={item.label}
						style={{
							width: 48,
							height: 48,
							alignItems: 'center',
							justifyContent: 'center',
							opacity: item.disabled ? 0.38 : 1
						}}
					>
						<Icon name={item.icon} size={24} color={m3.onSurfaceVariant} />
					</Pressable>
				) : item.kind === 'menu' ? (
					item.items.map((entry) => (
						<Pressable
							key={`${item.id}-${entry.id}`}
							onPress={entry.onPress}
							disabled={entry.disabled}
							style={{ paddingHorizontal: 12, height: 48, justifyContent: 'center' }}
						>
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>{entry.title}</Text>
						</Pressable>
					))
				) : null
			)}
		</View>
	);
}

function Screen({ children }: { children: ReactNode }) {
	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 48 }}
			keyboardShouldPersistTaps="handled"
		>
			{children}
		</ScrollView>
	);
}

const deleteItem = (onPress: () => void) => [
	{ id: 'delete', title: 'Delete', destructive: true, onPress }
];

function useMutate(binding: ComposeBinding, readOnly = false) {
	const [error, setError] = useState<string>();
	const mutate = (action: (document: ComposeDocument) => string): string | undefined => {
		if (readOnly) return undefined;
		const result = attempt(binding.text, action);
		if ('text' in result) {
			binding.setText(result.text);
			setError(undefined);
			return undefined;
		}
		setError(result.error);
		return result.error;
	};
	return { error, setError, mutate };
}

function AddFields({
	binding,
	options,
	visible,
	onClose
}: {
	binding: ComposeBinding;
	options: AddFieldsOptions;
	visible: boolean;
	onClose: () => void;
}) {
	return (
		<AddFieldsSheet
			visible={visible}
			text={binding.text}
			setText={binding.setText}
			options={options}
			onClose={onClose}
		/>
	);
}

const editorTabs = (second: string) => [
	{ value: 'editor' as const, title: 'Editor', systemImage: 'slider.horizontal.3' },
	{
		value: 'source' as const,
		title: second,
		systemImage: 'chevron.left.forwardslash.chevron.right'
	}
];

function menuItems(
	session: string,
	actions: ReturnType<typeof useComposeMenuActions>
): AndroidMenuItem[] {
	void session;
	return (actions ?? []).map((action) => ({
		id: action.id,
		title: action.title,
		disabled: action.disabled,
		onPress: action.onPress
	}));
}

function EditorScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'editor' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly } = destination;
	const menuActions = useComposeMenuActions(destination.binding.session);
	const [tab, setTab] = useState<'editor' | 'source'>('editor');
	const [addingConfiguration, setAddingConfiguration] = useState(false);
	const { error, mutate } = useMutate(binding, readOnly);
	const document = ComposeDocument.tryParse(binding.text);
	const yaml = tab === 'source';

	const items: AndroidMenuItem[] = [];
	if (!readOnly && !yaml)
		items.push({
			id: 'add-configuration',
			title: 'Add configuration',
			onPress: () => setAddingConfiguration(true)
		});
	items.push(...menuItems(destination.binding.session, menuActions));

	const rootFields = new Set((document?.nativeFields([]) ?? []).map((field) => field.name));
	const otherFields = (document?.nativeFields([]) ?? [])
		.filter((field) => !projectResourceKeys.includes(field.name))
		.map((field) => field.name);

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<ScreenChrome
				title={destination.title}
				items={
					items.length > 0
						? [
								{
									kind: 'menu',
									id: 'editor-actions',
									icon: 'ellipsis',
									label: 'Editor actions',
									items
								}
							]
						: []
				}
			/>
			<ScrollableTabBar
				selection={tab}
				onSelectionChange={setTab}
				options={editorTabs('YAML')}
				accessibilityLabel="Compose editor mode"
			/>
			{yaml ? (
				<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
					<CodeEditor
						text={binding.text}
						onChangeText={binding.setText}
						language="yaml"
						readOnly={readOnly}
					/>
				</View>
			) : document ? (
				<Screen>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							paddingHorizontal: 16,
							paddingTop: 20,
							paddingBottom: 6
						}}
					>
						<Text style={[m3Type.titleSmall, { color: colors.secondaryLabel, flex: 1 }]}>
							Services
						</Text>
						<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>Preview</Text>
					</View>
					<M3Section>
						{document.services.map((service) => {
							const image = serviceImage(document, service);
							return (
								<LongPressMenu
									key={service}
									title={service}
									items={
										readOnly
											? []
											: deleteItem(() => mutate(() => removingServices(binding.text, [service])))
									}
									onPress={() =>
										push({
											screen: 'service',
											binding: destination.binding,
											service,
											readOnly,
											menu: true
										})
									}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 12,
										paddingHorizontal: 16,
										paddingVertical: 12
									}}
								>
									<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} />
									<View style={{ flex: 1, gap: 4, paddingVertical: 6 }}>
										<Text style={[m3Type.titleMedium, { color: colors.label }]}>{service}</Text>
										{image !== undefined ? (
											<Text
												style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}
												numberOfLines={2}
												ellipsizeMode="middle"
											>
												{image}
											</Text>
										) : null}
									</View>
									<Icon name="chevron.right" size={20} color={colors.secondaryLabel} />
								</LongPressMenu>
							);
						})}
						{document.services.length === 0 ? (
							<EmptyRow
								icon="square.stack.3d.up"
								title="No services"
								description="Add a service to configure its container."
							/>
						) : null}
					</M3Section>
					{rootFields.has('volumes') || rootFields.has('networks') ? (
						<M3Section title="Project resources">
							{rootFields.has('volumes') ? (
								<NavRow
									title="Named volumes"
									subtitle={resourceSummary(document, 'volumes')}
									icon="externaldrive.fill"
									onPress={() =>
										push({
											screen: 'resourceList',
											binding: destination.binding,
											kind: 'volumes',
											readOnly
										})
									}
								/>
							) : null}
							{rootFields.has('networks') ? (
								<NavRow
									title="Networks"
									subtitle={resourceSummary(document, 'networks')}
									icon="network"
									onPress={() =>
										push({
											screen: 'resourceList',
											binding: destination.binding,
											kind: 'networks',
											readOnly
										})
									}
								/>
							) : null}
						</M3Section>
					) : null}
					{rootFields.has('x-arcane') ? (
						<M3Section>
							<NavRow
								title="Arcane metadata"
								subtitle="Icons, visibility, links and updates"
								icon="square.stack.3d.up.fill"
								onPress={() =>
									push(
										nativeFieldsDestination(
											destination.binding,
											['x-arcane'],
											'Arcane metadata',
											readOnly
										)
									)
								}
							/>
						</M3Section>
					) : null}
					{otherFields.length > 0 ? (
						<M3Section>
							<NavRow
								title="Project settings"
								subtitle={otherFields.join(', ')}
								icon="slider.horizontal.3"
								onPress={() =>
									push(
										nativeFieldsDestination(
											destination.binding,
											[],
											'Project settings',
											readOnly,
											projectResourceKeys
										)
									)
								}
							/>
						</M3Section>
					) : null}
					<ErrorText error={error} />
				</Screen>
			) : (
				<UnavailableView
					title="Open YAML to continue"
					systemImage="doc.text"
					description={parseError(binding.text)}
					actions={[{ title: 'Edit YAML', onPress: () => setTab('source') }]}
				/>
			)}
			{yaml ? <ErrorText error={error} /> : null}
			<AddFields
				binding={binding}
				visible={addingConfiguration}
				onClose={() => setAddingConfiguration(false)}
				options={{ fieldPath: [], includesProjectSettings: true }}
			/>
		</View>
	);
}

function EnvEditorScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'envEditor' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const { readOnly } = destination;
	const menuActions = useComposeMenuActions(destination.binding.session);
	const [tab, setTab] = useState<'editor' | 'source'>('editor');
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string>();
	const document = new EnvDocument(binding.text);
	const raw = tab === 'source';

	const change = (action: () => string) => {
		if (readOnly) return;
		try {
			binding.setText(action());
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};
	const items: AndroidMenuItem[] = [];
	if (!readOnly && !raw)
		items.push({ id: 'add-variable', title: 'Add variable', onPress: () => setAdding(true) });
	items.push(...menuItems(destination.binding.session, menuActions));

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<ScreenChrome
				title={destination.title}
				items={
					items.length > 0
						? [
								{
									kind: 'menu',
									id: 'editor-actions',
									icon: 'ellipsis',
									label: 'Editor actions',
									items
								}
							]
						: []
				}
			/>
			<ScrollableTabBar
				selection={tab}
				onSelectionChange={setTab}
				options={editorTabs('Text')}
				accessibilityLabel="Environment editor mode"
			/>
			{raw ? (
				<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
					<CodeEditor
						text={binding.text}
						onChangeText={binding.setText}
						language="env"
						readOnly={readOnly}
					/>
				</View>
			) : (
				<Screen>
					<Text
						style={[
							m3Type.labelMedium,
							{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 16 }
						]}
					>
						Preview
					</Text>
					{document.entries.map((entry, index) => {
						const isRevealed = revealed.has(entry.name);
						return (
							<M3Section key={entry.name} title={entry.name}>
								<LongPressMenu
									items={
										readOnly
											? []
											: deleteItem(() =>
													change(() => removingEnvEntries(binding.text, document.entries, [index]))
												)
									}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 12,
										paddingLeft: 16,
										minHeight: 56
									}}
								>
									<TextInput
										value={entry.value}
										onChangeText={(value) =>
											change(() => settingEnvValue(binding.text, entry, value))
										}
										secureTextEntry={!isRevealed}
										editable={!readOnly}
										placeholder="Value"
										placeholderTextColor={colors.tertiaryLabel as string}
										accessibilityLabel={entry.name}
										autoCapitalize="none"
										autoCorrect={false}
										style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
									/>
									<Pressable
										onPress={() =>
											setRevealed((current) => {
												const next = new Set(current);
												if (next.has(entry.name)) next.delete(entry.name);
												else next.add(entry.name);
												return next;
											})
										}
										disabled={readOnly}
										accessibilityRole="button"
										accessibilityLabel={`${isRevealed ? 'Hide' : 'Reveal'} ${entry.name}`}
										style={{ paddingHorizontal: 16, height: 48, justifyContent: 'center' }}
									>
										<Text style={[m3Type.labelLarge, { color: m3.primary }]}>
											{isRevealed ? 'Hide' : 'Reveal'}
										</Text>
									</Pressable>
								</LongPressMenu>
							</M3Section>
						);
					})}
					{document.entries.length === 0 ? (
						<M3Section>
							<EmptyRow
								icon="list.bullet"
								title="No environment variables"
								description="Use Add to create a variable."
							/>
						</M3Section>
					) : null}
					{document.unsupportedLines > 0 ? (
						<M3Section>
							<SecondaryText>{`Unsupported entries: ${document.unsupportedLines}`}</SecondaryText>
							<TextAction title="Open text editor" onPress={() => setTab('source')} />
						</M3Section>
					) : null}
					<ErrorText error={error} />
				</Screen>
			)}
			<NameSheet
				visible={adding}
				title="Add variable"
				placeholder="Variable name"
				onClose={() => setAdding(false)}
				save={(name) => {
					try {
						binding.setText(new EnvDocument(binding.text).adding(name));
						setError(undefined);
						return undefined;
					} catch (caught) {
						return composeErrorMessage(caught);
					}
				}}
			/>
		</View>
	);
}

function ScalarField({
	binding,
	path,
	title,
	readOnly,
	integer = false
}: {
	binding: ComposeBinding;
	path: string[];
	title: string;
	readOnly: boolean;
	integer?: boolean;
}) {
	const [error, setError] = useState<string>();
	const state = scalarFieldState(binding.text, path);
	if (!state.editable) return <ValueRow title={title} value="Unavailable" />;
	const set = (value: string) => {
		if (readOnly) return;
		try {
			binding.setText(settingScalar(binding.text, path, value, integer));
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};
	return (
		<>
			{state.options.values.length === 0 ? (
				<InlineInput
					title={title}
					value={state.value}
					onChangeText={set}
					editable={!readOnly}
					keyboardType={integer ? 'number-pad' : 'default'}
				/>
			) : (
				<ValuePicker
					title={title}
					options={state.options}
					value={state.value}
					onChange={set}
					disabled={readOnly}
				/>
			)}
			<ErrorText error={error} />
		</>
	);
}

function BooleanField({
	binding,
	path,
	title,
	readOnly,
	defaultValue = false
}: {
	binding: ComposeBinding;
	path: string[];
	title: string;
	readOnly: boolean;
	defaultValue?: boolean;
}) {
	const [error, setError] = useState<string>();
	const state = booleanFieldState(binding.text, path, defaultValue);
	return (
		<>
			{state.editable ? (
				<SwitchRow
					title={title}
					value={state.isOn}
					disabled={readOnly}
					onValueChange={(enabled) => {
						if (readOnly) return;
						try {
							binding.setText(settingBoolean(binding.text, path, enabled));
							setError(undefined);
						} catch (caught) {
							setError(composeErrorMessage(caught));
						}
					}}
				/>
			) : (
				<ValueRow title={title} value="Unavailable" />
			)}
			<ErrorText error={error} />
		</>
	);
}

function PolicyPicker({
	binding,
	path,
	title,
	keyName,
	readOnly,
	onError
}: {
	binding: ComposeBinding;
	path: string[];
	title: string;
	keyName: string;
	readOnly: boolean;
	onError: (error?: string) => void;
}) {
	const { options, current, custom } = policyOptions(binding.text, path, keyName);
	const choices = [
		{ value: '', label: 'Default' },
		...options.values.map((value) => ({ value, label: options.label(value) }))
	];
	if (custom) choices.push({ value: current, label: 'Custom: ' + current });
	return (
		<ChoiceRow
			title={title}
			selection={current}
			choices={choices}
			disabled={readOnly}
			onSelect={(selected) => {
				try {
					binding.setText(settingPolicy(binding.text, path, keyName, selected));
					onError(undefined);
				} catch (caught) {
					onError(composeErrorMessage(caught));
				}
			}}
		/>
	);
}

function Tile({
	title,
	icon,
	tint,
	summary,
	onPress
}: {
	title: string;
	icon: string;
	tint: string;
	summary: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			android_ripple={ripple}
			accessibilityRole="button"
			style={{
				flexBasis: '47%',
				flexGrow: 1,
				padding: 16,
				gap: 12,
				borderRadius: 16,
				overflow: 'hidden',
				backgroundColor: colors.secondarySystemGroupedBackground
			}}
		>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Icon name={icon} size={24} color={tint} />
				<View style={{ flex: 1 }} />
				<Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
			</View>
			<View style={{ gap: 4 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label }]}>{title}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{summary}</Text>
			</View>
		</Pressable>
	);
}

function RouteGroup({ children }: { children: ReactNode }) {
	return (
		<View
			style={{
				borderRadius: 16,
				overflow: 'hidden',
				backgroundColor: colors.secondarySystemGroupedBackground
			}}
		>
			{children}
		</View>
	);
}

function Route({
	title,
	icon,
	summary,
	onPress
}: {
	title: string;
	icon: string;
	summary: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			android_ripple={ripple}
			accessibilityRole="button"
			style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
		>
			<View style={{ width: 22, alignItems: 'center' }}>
				<Icon name={icon} size={20} color={colors.secondaryLabel} />
			</View>
			<View style={{ flex: 1, gap: 3 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label }]}>{title}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]} numberOfLines={2}>
					{summary}
				</Text>
			</View>
			<Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
		</Pressable>
	);
}

function ServiceScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'service' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, service } = destination;
	const ref = destination.binding;
	const menuActions = useComposeMenuActions(ref.session);
	const [addingFields, setAddingFields] = useState(false);
	const model = new ServiceFormModel(binding.text, service);
	const path = model.path;
	const has = (key: string) => model.has(key);
	const strings = (key: string, title: string, allowsScalar = true): ComposeDestination => ({
		screen: 'stringList',
		binding: ref,
		path: [...path, key],
		title,
		readOnly,
		allowsScalar,
		environmentFiles: key === 'env_file'
	});
	const sub = (
		screen: 'imageSettings' | 'runtime' | 'identity' | 'nameResolution' | 'pullPolicy'
	): ComposeDestination => ({ screen, binding: ref, service, readOnly });

	const items: AndroidMenuItem[] = [];
	if (!readOnly)
		items.push({
			id: 'add-configuration',
			title: 'Add configuration',
			onPress: () => setAddingFields(true)
		});
	if (destination.menu) items.push(...menuItems(ref.session, menuActions));

	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={service}
				items={
					items.length > 0
						? [
								{
									kind: 'menu',
									id: 'service-actions',
									icon: 'ellipsis',
									label: 'Service actions',
									items
								}
							]
						: []
				}
			/>
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}
			>
				{has('image') ? (
					<Pressable
						onPress={() => push(sub('imageSettings'))}
						android_ripple={ripple}
						accessibilityRole="button"
						style={{
							flexDirection: 'row',
							alignItems: 'flex-start',
							gap: 14,
							padding: 18,
							borderRadius: 24,
							overflow: 'hidden',
							backgroundColor: colors.secondarySystemGroupedBackground
						}}
					>
						<View style={{ padding: 12, borderRadius: 12, backgroundColor: m3.primaryContainer }}>
							<Icon name="shippingbox.fill" size={26} color={m3.primary} />
						</View>
						<View style={{ flex: 1, gap: 6 }}>
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								Container image
							</Text>
							<Text selectable style={[m3Type.titleMedium, { color: colors.label }]}>
								{model.value('image') ?? 'Choose an image'}
							</Text>
							{has('pull_policy') ? (
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									{'Pull policy: ' + (model.value('pull_policy') ?? 'Default')}
								</Text>
							) : null}
						</View>
						<Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
					</Pressable>
				) : null}

				{model.hasAny(['ports', 'volumes', 'networks', 'environment', 'env_file', 'labels']) ? (
					<View style={{ gap: 10 }}>
						<Text style={[m3Type.titleMedium, { color: colors.label }]}>Configuration</Text>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
							{has('ports') ? (
								<Tile
									title="Ports"
									icon="arrow.left.arrow.right"
									tint={systemColors.blue}
									summary={model.countSummary('ports', 'port', 'ports')}
									onPress={() =>
										push({
											screen: 'collection',
											binding: ref,
											path: [...path, 'ports'],
											title: 'Ports',
											kind: 'port',
											readOnly
										})
									}
								/>
							) : null}
							{has('volumes') ? (
								<Tile
									title="Mounts"
									icon="externaldrive"
									tint={systemColors.orange}
									summary={model.countSummary('volumes', 'mount', 'mounts')}
									onPress={() =>
										push({
											screen: 'collection',
											binding: ref,
											path: [...path, 'volumes'],
											title: 'Mounts',
											kind: 'mount',
											readOnly
										})
									}
								/>
							) : null}
							{has('networks') ? (
								<Tile
									title="Networks"
									icon="network"
									tint={systemColors.teal}
									summary={model.countSummary('networks', 'attachment', 'attachments')}
									onPress={() =>
										push({
											screen: 'networkAttachments',
											binding: ref,
											path: [...path, 'networks'],
											readOnly
										})
									}
								/>
							) : null}
							{has('environment') ? (
								<Tile
									title="Environment"
									icon="key.horizontal"
									tint={systemColors.purple}
									summary={model.countSummary('environment', 'variable', 'variables')}
									onPress={() =>
										push({
											screen: 'mapping',
											binding: ref,
											path: [...path, 'environment'],
											title: 'Environment variables',
											resource: false,
											sensitive: true,
											readOnly
										})
									}
								/>
							) : null}
							{has('env_file') ? (
								<Tile
									title="Environment files"
									icon="doc.text"
									tint={systemColors.indigo}
									summary={model.countSummary('env_file', 'file', 'files')}
									onPress={() => push(strings('env_file', 'Environment files'))}
								/>
							) : null}
							{has('labels') ? (
								<Tile
									title="Labels"
									icon="tag"
									tint={systemColors.brown}
									summary={model.countSummary('labels', 'label', 'labels')}
									onPress={() =>
										push({
											screen: 'mapping',
											binding: ref,
											path: [...path, 'labels'],
											title: 'Labels',
											resource: false,
											sensitive: true,
											readOnly
										})
									}
								/>
							) : null}
						</View>
					</View>
				) : null}

				{has('healthcheck') ? (
					<RouteGroup>
						<Route
							title="Healthcheck"
							icon="heart.text.clipboard"
							summary={model.healthcheckSummary}
							onPress={() =>
								push({
									screen: 'healthcheck',
									binding: ref,
									path: [...path, 'healthcheck'],
									readOnly
								})
							}
						/>
					</RouteGroup>
				) : null}

				{model.hasAny([
					'restart',
					'command',
					'entrypoint',
					'container_name',
					'hostname',
					'domainname',
					'extra_hosts',
					'dns',
					'dns_opt',
					'dns_search'
				]) ? (
					<RouteGroup>
						{model.hasAny(['restart', 'command', 'entrypoint']) ? (
							<Route
								title="Runtime"
								icon="terminal"
								summary={model.runtimeSummary}
								onPress={() => push(sub('runtime'))}
							/>
						) : null}
						{model.hasAny(['container_name', 'hostname', 'domainname']) ? (
							<Route
								title="Identity"
								icon="person.text.rectangle"
								summary={model.identitySummary}
								onPress={() => push(sub('identity'))}
							/>
						) : null}
						{model.hasAny(['extra_hosts', 'dns', 'dns_opt', 'dns_search']) ? (
							<Route
								title="Name resolution"
								icon="globe"
								summary="DNS and host mappings"
								onPress={() => push(sub('nameResolution'))}
							/>
						) : null}
					</RouteGroup>
				) : null}

				{has('x-arcane') ? (
					<RouteGroup>
						<Route
							title="Arcane metadata"
							icon="square.stack.3d.up.fill"
							summary="Icons, visibility and updates"
							onPress={() =>
								push(
									nativeFieldsDestination(ref, [...path, 'x-arcane'], 'Arcane metadata', readOnly)
								)
							}
						/>
					</RouteGroup>
				) : null}
				{model.additionalFields.length > 0 ? (
					<View style={{ gap: 8 }}>
						<Text style={[m3Type.titleMedium, { color: colors.label }]}>Additional settings</Text>
						<RouteGroup>
							{model.additionalFields.map((key) => (
								<Route
									key={key}
									title={key
										.replace(/_/g, ' ')
										.replace(
											/[^\s]+/g,
											(word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
										)}
									icon="slider.horizontal.3"
									summary="Configured"
									onPress={() => push(nativeFieldsDestination(ref, [...path, key], key, readOnly))}
								/>
							))}
						</RouteGroup>
					</View>
				) : null}
				{has('pull_policy') && !has('image') ? (
					<RouteGroup>
						<Route
							title="Pull policy"
							icon="arrow.down.circle"
							summary={model.value('pull_policy') ?? 'Default'}
							onPress={() => push(sub('pullPolicy'))}
						/>
					</RouteGroup>
				) : null}
				{model.existingFields.size > 0 ? (
					<RouteGroup>
						<Route
							title="All service settings"
							icon="slider.horizontal.3"
							summary="Browse every configuration field"
							onPress={() => push(nativeFieldsDestination(ref, path, 'Service settings', readOnly))}
						/>
					</RouteGroup>
				) : null}
			</ScrollView>
			<AddFields
				binding={binding}
				visible={addingFields}
				onClose={() => setAddingFields(false)}
				options={{ fieldPath: keyPath(path) }}
			/>
		</View>
	);
}

function ServiceSubScreen({
	destination
}: {
	destination: Extract<
		ComposeDestination,
		{ screen: 'imageSettings' | 'runtime' | 'identity' | 'nameResolution' | 'pullPolicy' }
	>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, service } = destination;
	const ref = destination.binding;
	const [error, setError] = useState<string>();
	const model = new ServiceFormModel(binding.text, service);
	const path = model.path;
	const has = (key: string) => model.has(key);
	const strings = (key: string, title: string, allowsScalar = true): ComposeDestination => ({
		screen: 'stringList',
		binding: ref,
		path: [...path, key],
		title,
		readOnly,
		allowsScalar,
		environmentFiles: key === 'env_file'
	});
	const policy = (title: string, keyName: string) => (
		<PolicyPicker
			binding={binding}
			path={path}
			title={title}
			keyName={keyName}
			readOnly={readOnly}
			onError={setError}
		/>
	);
	const scalar = (title: string, keyName: string) => (
		<ScalarField binding={binding} path={[...path, keyName]} title={title} readOnly={readOnly} />
	);

	switch (destination.screen) {
		case 'imageSettings':
			return (
				<Screen>
					<ScreenChrome title="Image settings" />
					<M3Section title="Image">{scalar('Image', 'image')}</M3Section>
					{has('pull_policy') ? (
						<M3Section>{policy('Pull policy', 'pull_policy')}</M3Section>
					) : null}
					<ErrorText error={error} />
				</Screen>
			);
		case 'runtime':
			return (
				<Screen>
					<ScreenChrome title="Runtime" />
					{has('restart') ? <M3Section>{policy('Restart policy', 'restart')}</M3Section> : null}
					<ErrorText error={error} />
					{has('command') || has('entrypoint') ? (
						<M3Section>
							{has('command') ? (
								<NavRow title="Command" onPress={() => push(strings('command', 'Command'))} />
							) : null}
							{has('entrypoint') ? (
								<NavRow
									title="Entrypoint"
									onPress={() => push(strings('entrypoint', 'Entrypoint'))}
								/>
							) : null}
						</M3Section>
					) : null}
				</Screen>
			);
		case 'identity':
			return (
				<Screen>
					<ScreenChrome title="Identity" />
					<M3Section>
						{has('container_name') ? scalar('Container name', 'container_name') : null}
						{has('hostname') ? scalar('Hostname', 'hostname') : null}
						{has('domainname') ? scalar('Domain name', 'domainname') : null}
					</M3Section>
				</Screen>
			);
		case 'nameResolution':
			return (
				<Screen>
					<ScreenChrome title="Name resolution" />
					<M3Section>
						{has('extra_hosts') ? (
							<NavRow
								title="Extra hosts"
								onPress={() =>
									push(
										model.isSequence('extra_hosts')
											? strings('extra_hosts', 'Extra hosts', false)
											: {
													screen: 'mapping',
													binding: ref,
													path: [...path, 'extra_hosts'],
													title: 'Extra hosts',
													resource: false,
													sensitive: false,
													readOnly
												}
									)
								}
							/>
						) : null}
						{has('dns') ? (
							<NavRow title="DNS servers" onPress={() => push(strings('dns', 'DNS servers'))} />
						) : null}
						{has('dns_opt') ? (
							<NavRow title="DNS options" onPress={() => push(strings('dns_opt', 'DNS options'))} />
						) : null}
						{has('dns_search') ? (
							<NavRow
								title="DNS search domains"
								onPress={() => push(strings('dns_search', 'DNS search domains'))}
							/>
						) : null}
					</M3Section>
				</Screen>
			);
		case 'pullPolicy':
			return (
				<Screen>
					<ScreenChrome title="Pull policy" />
					<M3Section>{policy('Pull policy', 'pull_policy')}</M3Section>
					<ErrorText error={error} />
				</Screen>
			);
	}
}

function NativeFieldsScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'nativeFields' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, fieldPath, schemaPath, title } = destination;
	const excluding = new Set(destination.excluding);
	const [editing, setEditing] = useState<ComposeNativeField>();
	const [simpleEditing, setSimpleEditing] = useState<ComposeNativeField>();
	const [simpleValue, setSimpleValue] = useState('');
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string>();
	const document = ComposeDocument.tryParse(binding.text);
	const current = document?.nativeField(fieldPath, title);
	const fields = (document?.nativeFields(fieldPath) ?? []).filter(
		(field) => !excluding.has(field.name)
	);
	const isCollection = current?.kind === 'mapping' || current?.kind === 'sequence';
	const childSchema = (field: ComposeNativeField): ComposeFieldPathComponent[] => [
		...schemaPath,
		...field.path.slice(fieldPath.length)
	];

	const apply = (action: (text: string) => string): string | undefined => {
		try {
			binding.setText(action(binding.text));
			setError(undefined);
			return undefined;
		} catch (caught) {
			return composeErrorMessage(caught);
		}
	};
	const mutate = (action: (text: string) => string) =>
		setError(readOnly ? undefined : apply(action));
	const save = (field: ComposeNativeField, kind: ComposeNativeKind, value: string) =>
		readOnly ? undefined : apply((text) => savingNativeField(text, field, kind, value));

	const row = (field: ComposeNativeField): ReactNode => {
		const label = ComposeDisplayText.title(field.name);
		switch (field.kind) {
			case 'mapping':
			case 'sequence':
				return (
					<NavRow
						title={label}
						value={nativeKindTitle[field.kind]}
						onPress={() =>
							push({
								screen: 'nativeFields',
								binding: destination.binding,
								fieldPath: field.path,
								schemaPath: childSchema(field),
								title: field.name,
								readOnly,
								excluding: []
							})
						}
					/>
				);
			case 'unsupported':
				return (
					<View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 4 }}>
						<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{label}</Text>
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>Unavailable</Text>
					</View>
				);
			case 'boolean':
				return (
					<SwitchRow
						title={label}
						value={document?.nativeField(field.path).value.toLowerCase() === 'true'}
						disabled={readOnly}
						onValueChange={(value) =>
							mutate((text) =>
								ComposeDocument.parse(text).settingNative(String(value), 'boolean', field.path)
							)
						}
					/>
				);
			default: {
				const options = new ComposeFieldOptions(childSchema(field));
				const isSimpleEditing =
					simpleEditing !== undefined && pathID(simpleEditing.path) === pathID(field.path);
				if (
					!isSimpleEditing &&
					(field.kind === 'string' || field.kind === 'number') &&
					options.values.length > 0
				) {
					const choices = options.values.map((value) => ({ value, label: options.label(value) }));
					if (!options.values.includes(field.value))
						choices.unshift({ value: field.value, label: field.value });
					if (options.allowsCustom) choices.push({ value: '__custom__', label: 'Custom value…' });
					return (
						<ChoiceRow
							title={label}
							selection={document?.nativeField(field.path).value ?? field.value}
							choices={choices}
							disabled={readOnly}
							onSelect={(value) => {
								if (value === '__custom__') {
									setSimpleValue(field.value);
									setSimpleEditing(field);
								} else {
									mutate((text) =>
										ComposeDocument.parse(text).settingNative(value, field.kind, field.path)
									);
								}
							}}
						/>
					);
				}
				if (isSimpleEditing) {
					return (
						<View style={{ paddingVertical: 4 }}>
							<InlineInput
								title={label}
								value={simpleValue}
								onChangeText={setSimpleValue}
								placeholder="Value"
								autoFocus
								editable={!readOnly}
								keyboardType={field.kind === 'number' ? 'numbers-and-punctuation' : 'default'}
							/>
							<View
								style={{
									flexDirection: 'row',
									justifyContent: 'flex-end',
									gap: 8,
									paddingHorizontal: 16,
									paddingBottom: 8
								}}
							>
								<TextAction title="Cancel" onPress={() => setSimpleEditing(undefined)} />
								<Pressable
									onPress={() => {
										if (!simpleEditing) return;
										const result = save(simpleEditing, simpleEditing.kind, simpleValue);
										setError(result);
										if (result === undefined) setSimpleEditing(undefined);
									}}
									accessibilityRole="button"
									style={{
										paddingHorizontal: 24,
										height: 40,
										borderRadius: 20,
										justifyContent: 'center',
										backgroundColor: m3.primary
									}}
								>
									<Text style={[m3Type.labelLarge, { color: m3.onPrimary }]}>Apply</Text>
								</Pressable>
							</View>
						</View>
					);
				}
				return (
					<NavRow
						title={label}
						value={field.kind === 'null' ? 'Empty' : field.value}
						chevron={false}
						disabled={readOnly || simpleEditing !== undefined}
						onPress={() => {
							if (editsInline(field)) {
								setSimpleValue(field.value);
								setSimpleEditing(field);
							} else {
								setEditing(field);
							}
						}}
					/>
				);
			}
		}
	};

	const showAdd = !readOnly && (isCollection || current?.kind === 'null');
	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={ComposeDisplayText.title(title)}
				items={
					showAdd
						? [
								{
									kind: 'menu',
									id: 'configuration-actions',
									icon: 'ellipsis',
									label: 'Configuration actions',
									items: [{ id: 'add', title: 'Add', onPress: () => setAdding(true) }]
								}
							]
						: []
				}
			/>
			<Screen>
				<M3Section>
					{current ? (
						isCollection ? (
							<>
								{fields.map((field, index) => (
									<LongPressMenu
										key={pathID(field.path)}
										items={
											readOnly || simpleEditing !== undefined
												? []
												: deleteItem(() =>
														mutate((text) => removingNativeFields(text, fields, [index]))
													)
										}
									>
										{row(field)}
									</LongPressMenu>
								))}
								{fields.length === 0 ? (
									<SecondaryText>
										{current.kind === 'sequence' ? 'No items' : 'No fields'}
									</SecondaryText>
								) : null}
							</>
						) : current.kind === 'null' ? (
							<>
								<SecondaryText>No value configured</SecondaryText>
								{!readOnly ? (
									<TextAction title="Set value" onPress={() => setEditing(current)} />
								) : null}
							</>
						) : (
							row(current)
						)
					) : (
						<SecondaryText>The document has a syntax error. Your text is preserved.</SecondaryText>
					)}
				</M3Section>
				{error ? (
					<M3Section>
						<ErrorText error={error} />
					</M3Section>
				) : null}
			</Screen>
			{editing ? (
				<NativeValueSheet
					key={pathID(editing.path)}
					title={editing.name}
					kind={editing.kind}
					value={editing.value}
					needsName={false}
					onClose={() => setEditing(undefined)}
					save={(_, kind, value) => save(editing, kind, value)}
				/>
			) : null}
			<AddFields
				binding={binding}
				visible={adding}
				onClose={() => setAdding(false)}
				options={{ fieldPath, excluding: [...excluding], schemaPath }}
			/>
		</View>
	);
}

function MappingScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'mapping' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const { readOnly, path, title, resource, sensitive } = destination;
	const [adding, setAdding] = useState(false);
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	const { error, mutate } = useMutate(binding);
	const document = ComposeDocument.tryParse(binding.text);

	if (mappingNativeFallback(document, path)) {
		return (
			<NativeFieldsScreen
				destination={
					nativeFieldsDestination(destination.binding, path, title, readOnly) as Extract<
						ComposeDestination,
						{ screen: 'nativeFields' }
					>
				}
			/>
		);
	}
	if (!resource && document?.items(path) !== undefined) {
		return (
			<CollectionScreen
				destination={{
					screen: 'collection',
					binding: destination.binding,
					path,
					title,
					kind: 'keyValue',
					readOnly
				}}
			/>
		);
	}
	const keys = document?.isEditable(path) ? document.keys(path) : undefined;
	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={title}
				items={
					!readOnly
						? [
								{
									kind: 'button',
									id: 'add',
									icon: 'plus',
									label: 'Add',
									onPress: () => setAdding(true)
								}
							]
						: []
				}
			/>
			<Screen>
				{keys !== undefined && document ? (
					<>
						{keys.map((key, index) => (
							<M3Section key={key} title={key}>
								<LongPressMenu
									items={
										readOnly
											? []
											: deleteItem(() =>
													mutate(() => removingKeys(binding.text, path, [keys[index]!]))
												)
									}
								>
									{resource ? (
										<ValueRow title="Name" value={key} />
									) : document.scalar([...path, key]) !== undefined ||
									  document.rawValue([...path, key]) === undefined ? (
										<View
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												paddingLeft: 16,
												minHeight: 56
											}}
										>
											<TextInput
												value={document.scalar([...path, key]) ?? ''}
												onChangeText={(value) =>
													mutate((current) =>
														current.setting(ComposeDocument.quoted(value), [...path, key])
													)
												}
												secureTextEntry={!(revealed.has(key) || title === 'Labels' || !sensitive)}
												editable={!readOnly}
												placeholder="Value"
												placeholderTextColor={colors.tertiaryLabel as string}
												accessibilityLabel={key}
												autoCapitalize="none"
												autoCorrect={false}
												style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
											/>
											{title !== 'Labels' && sensitive ? (
												<Pressable
													onPress={() =>
														setRevealed((current) => {
															const next = new Set(current);
															if (next.has(key)) next.delete(key);
															else next.add(key);
															return next;
														})
													}
													disabled={readOnly}
													accessibilityRole="button"
													style={{ paddingHorizontal: 16, height: 48, justifyContent: 'center' }}
												>
													<Text style={[m3Type.labelLarge, { color: m3.primary }]}>
														{revealed.has(key) ? 'Hide' : 'Reveal'}
													</Text>
												</Pressable>
											) : null}
										</View>
									) : (
										<SecondaryText>Unsupported value</SecondaryText>
									)}
								</LongPressMenu>
							</M3Section>
						))}
						{keys.length === 0 ? (
							<M3Section>
								<EmptyRow
									icon="list.bullet"
									title={'No ' + title.toLowerCase()}
									description="Use Add to create an entry."
								/>
							</M3Section>
						) : null}
					</>
				) : (
					<M3Section>
						<SecondaryText>Unsupported format</SecondaryText>
					</M3Section>
				)}
				<ErrorText error={error} />
			</Screen>
			<NameSheet
				visible={adding}
				title="Add entry"
				placeholder="Name"
				onClose={() => setAdding(false)}
				save={(name) => mutate((current) => addingMappingEntry(current, path, name))}
			/>
		</View>
	);
}

let selectionCounter = 0;

function CollectionScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'collection' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, path, title, kind } = destination;
	const [editing, setEditing] = useState<EntrySelection>();
	const [error, setError] = useState<string>();
	const document = ComposeDocument.tryParse(binding.text);

	if (collectionNativeFallback(document, path)) {
		return (
			<NativeFieldsScreen
				destination={
					nativeFieldsDestination(destination.binding, path, title, readOnly) as Extract<
						ComposeDestination,
						{ screen: 'nativeFields' }
					>
				}
			/>
		);
	}
	const items = collectionItems(document, path);
	const select = (index: number | undefined, raw: string) =>
		setEditing({ id: `entry-${++selectionCounter}`, index, raw });

	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={title}
				items={
					!readOnly
						? [
								{
									kind: 'button',
									id: 'add',
									icon: 'plus',
									label: 'Add',
									onPress: () => select(undefined, '')
								}
							]
						: []
				}
			/>
			<Screen>
				<M3Section>
					{items !== undefined ? (
						<>
							{items.map((item, index) => (
								<LongPressMenu
									key={`${index}-${item}`}
									items={
										readOnly
											? []
											: deleteItem(() => {
													try {
														binding.setText(removingItems(binding.text, path, [index]));
														setError(undefined);
													} catch (caught) {
														setError(composeErrorMessage(caught));
													}
												})
									}
								>
									<NavRow
										title={kind === 'keyValue' ? entryName(item) : item}
										disabled={readOnly}
										onPress={() => select(index, item)}
									/>
								</LongPressMenu>
							))}
							{items.length === 0 ? (
								<EmptyRow
									icon="list.bullet"
									title={'No ' + title.toLowerCase()}
									description="Use Add to create an entry."
								/>
							) : null}
						</>
					) : kind === 'network' ? (
						<NavRow
							title="Network attachments"
							onPress={() =>
								push({ screen: 'networkAttachments', binding: destination.binding, path, readOnly })
							}
						/>
					) : (
						<SecondaryText>Unsupported format</SecondaryText>
					)}
					<ErrorText error={error} />
				</M3Section>
			</Screen>
			{editing ? (
				<EntrySheet
					key={editing.id}
					kind={kind}
					original={editing.raw}
					schemaPath={[...keyPath(path), { index: editing.index ?? 0 }]}
					onClose={() => setEditing(undefined)}
					renderNativeFields={({ session, schemaPath }) => (
						<DialogStack
							root={{
								screen: 'nativeFields',
								binding: { session },
								fieldPath: [{ key: 'entry' }],
								schemaPath,
								title: 'Entry settings',
								readOnly: false,
								excluding: []
							}}
						/>
					)}
					save={(raw, externalResource) => {
						try {
							const result = savingCollectionEntry(
								binding.text,
								path,
								kind,
								editing,
								raw,
								externalResource
							);
							if (result !== undefined) binding.setText(result);
							setError(undefined);
							return undefined;
						} catch (caught) {
							return composeErrorMessage(caught);
						}
					}}
				/>
			) : null}
		</View>
	);
}

function StringListScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'stringList' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, path, title, allowsScalar, environmentFiles } = destination;
	const [adding, setAdding] = useState(false);
	const [newValue, setNewValue] = useState('');
	const { error, setError, mutate } = useMutate(binding, readOnly);
	const document = ComposeDocument.tryParse(binding.text);

	if (stringListNeedsNativeFields(document, path)) {
		return (
			<NativeFieldsScreen
				destination={
					nativeFieldsDestination(destination.binding, path, title, readOnly) as Extract<
						ComposeDestination,
						{ screen: 'nativeFields' }
					>
				}
			/>
		);
	}
	const items = document?.isEditable(path) ? document.items(path) : undefined;
	const scalar = document?.isEditable(path) && allowsScalar ? document.scalar(path) : undefined;

	let fields: ReactNode;
	if (items !== undefined) {
		fields = (
			<>
				{items.map((raw, index) => {
					const value = decodedItem(raw);
					const entry = environmentFiles ? ComposeDocument.tryParse(raw) : undefined;
					return (
						<LongPressMenu
							key={`${index}`}
							items={
								readOnly
									? []
									: deleteItem(() => mutate(() => removingItems(binding.text, path, [index])))
							}
						>
							{value !== undefined ? (
								<InlineInput
									value={value}
									placeholder="Value"
									editable={!readOnly}
									onChangeText={(next) =>
										mutate((current) =>
											current.settingItem(ComposeDocument.quoted(next), path, index)
										)
									}
								/>
							) : environmentFiles && entry && entry.nativeField([]).kind === 'mapping' ? (
								<NavRow
									title={entry.scalar(['path']) ?? 'Environment file'}
									onPress={() =>
										push({
											screen: 'envFile',
											binding: withTransform(destination.binding, {
												kind: 'item',
												path,
												index,
												original: raw
											}),
											readOnly,
											schemaPath: [...keyPath(path), { index }]
										})
									}
								/>
							) : (
								<ValueRow title="Value" value="Unsupported value" />
							)}
						</LongPressMenu>
					);
				})}
			</>
		);
	} else if (scalar !== undefined && scalar !== 'null' && scalar !== '~') {
		fields = (
			<LongPressMenu
				items={readOnly ? [] : deleteItem(() => mutate((current) => current.removing(path)))}
			>
				<ScalarField binding={binding} path={path} title="Value" readOnly={readOnly} />
			</LongPressMenu>
		);
	} else if (document?.rawValue(path) === undefined) {
		fields = null;
	} else {
		fields = <SecondaryText>Unsupported format</SecondaryText>;
	}

	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={title}
				items={
					!readOnly
						? [
								{
									kind: 'button',
									id: 'add',
									icon: 'plus',
									label: 'Add',
									onPress: () => {
										setNewValue('');
										setError(undefined);
										setAdding(true);
									}
								}
							]
						: []
				}
			/>
			<Screen>
				<M3Section title={title}>{fields}</M3Section>
				<ErrorText error={error} />
			</Screen>
			<FullScreenDialog
				visible={adding}
				title="Add value"
				onClose={() => setAdding(false)}
				confirmTitle="Add"
				confirmDisabled={newValue === ''}
				onConfirm={() => {
					const result = mutate((current) => addingStringValue(current, path, newValue));
					if (result === undefined) {
						setAdding(false);
						setNewValue('');
					}
				}}
			>
				<M3Section>
					<InlineInput title="Value" value={newValue} onChangeText={setNewValue} autoFocus />
					<ErrorText error={error} />
				</M3Section>
			</FullScreenDialog>
		</View>
	);
}

function HealthcheckScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'healthcheck' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, path } = destination;
	const [adding, setAdding] = useState(false);
	const fields = fieldNames(binding.text, keyPath(path));
	const scalar = (title: string, keyName: string, integer = false) =>
		fields.has(keyName) ? (
			<ScalarField
				binding={binding}
				path={[...path, keyName]}
				title={title}
				readOnly={readOnly}
				integer={integer}
			/>
		) : null;
	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title="Healthcheck"
				items={
					!readOnly
						? [
								{
									kind: 'menu',
									id: 'actions',
									icon: 'ellipsis',
									label: 'Actions',
									items: [{ id: 'add', title: 'Add configuration', onPress: () => setAdding(true) }]
								}
							]
						: []
				}
			/>
			<Screen>
				{fields.has('test') ? (
					<M3Section title="Command">
						{ComposeDocument.tryParse(binding.text)?.scalar([...path, 'test']) !== undefined ? (
							<ScalarField
								binding={binding}
								path={[...path, 'test']}
								title="Shell command"
								readOnly={readOnly}
							/>
						) : (
							<NavRow
								title="Command arguments"
								onPress={() =>
									push({
										screen: 'stringList',
										binding: destination.binding,
										path: [...path, 'test'],
										title: 'Command arguments',
										readOnly,
										allowsScalar: false,
										environmentFiles: false
									})
								}
							/>
						)}
					</M3Section>
				) : null}
				{['interval', 'timeout', 'start_period', 'start_interval', 'retries', 'disable'].some(
					(key) => fields.has(key)
				) ? (
					<M3Section title="Timing">
						{scalar('Interval', 'interval')}
						{scalar('Timeout', 'timeout')}
						{scalar('Start period', 'start_period')}
						{scalar('Start interval', 'start_interval')}
						{scalar('Retries', 'retries', true)}
						{fields.has('disable') ? (
							<BooleanField
								binding={binding}
								path={[...path, 'disable']}
								title="Disable"
								readOnly={readOnly}
							/>
						) : null}
					</M3Section>
				) : null}
				<M3Section>
					{fields.size === 0 ? (
						<EmptyRow icon="heart.text.clipboard" title="No healthcheck settings" />
					) : (
						<NavRow
							title="All healthcheck settings"
							onPress={() =>
								push(
									nativeFieldsDestination(
										destination.binding,
										path,
										'Healthcheck settings',
										readOnly
									)
								)
							}
						/>
					)}
				</M3Section>
			</Screen>
			<AddFields
				binding={binding}
				visible={adding}
				onClose={() => setAdding(false)}
				options={{ fieldPath: keyPath(path) }}
			/>
		</View>
	);
}

function NetworkAttachmentsScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'networkAttachments' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, path } = destination;
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState('');
	const [externalResource, setExternalResource] = useState<string>();
	const [showResources, setShowResources] = useState(false);
	const { error, setError, mutate } = useMutate(binding, readOnly);
	const document = ComposeDocument.tryParse(binding.text);
	const names = attachmentNames(document, path);
	const attachmentRef: ComposeBindingRef = withTransform(destination.binding, {
		kind: 'attachments',
		path
	});

	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title="Networks"
				items={
					!readOnly && names !== undefined
						? [
								{
									kind: 'button',
									id: 'add',
									icon: 'plus',
									label: 'Add',
									onPress: () => {
										setName('');
										setExternalResource(undefined);
										setError(undefined);
										setAdding(true);
									}
								}
							]
						: []
				}
			/>
			<Screen>
				{names !== undefined ? (
					<M3Section title="Network attachments">
						{names.map((key, index) => (
							<LongPressMenu
								key={`${index}-${key}`}
								items={
									readOnly
										? []
										: deleteItem(() =>
												mutate(() => removingAttachments(binding.text, path, names, [index]))
											)
								}
							>
								<NavRow
									title={key}
									onPress={() =>
										push({
											screen: 'networkAttachment',
											binding: attachmentRef,
											path,
											name: key,
											readOnly
										})
									}
								/>
							</LongPressMenu>
						))}
					</M3Section>
				) : (
					<M3Section>
						<NavRow
							title="Network settings"
							onPress={() =>
								push(
									nativeFieldsDestination(destination.binding, path, 'Network settings', readOnly)
								)
							}
						/>
					</M3Section>
				)}
				<ErrorText error={error} />
			</Screen>
			<FullScreenDialog
				visible={adding}
				title="Add network"
				onClose={() => setAdding(false)}
				confirmTitle="Add"
				confirmDisabled={name === '' || !validName(name)}
				onConfirm={() => {
					const result = mutate((current) =>
						addingAttachment(current, path, name, names ?? [], externalResource)
					);
					if (result === undefined) {
						setAdding(false);
						setName('');
					}
				}}
			>
				<M3Section>
					<View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>Network name</Text>
					</View>
					<InlineInput value={name} onChangeText={setName} placeholder="Network name" autoFocus />
					<TextAction title="Choose existing network" onPress={() => setShowResources(true)} />
					<ErrorText error={error} />
				</M3Section>
			</FullScreenDialog>
			{showResources ? (
				<ResourcePicker
					kind="network"
					selection={name}
					onClose={() => setShowResources(false)}
					onSelect={(selected) => {
						setName(selected);
						setExternalResource(selected);
					}}
				/>
			) : null}
		</View>
	);
}

function NetworkAttachmentScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'networkAttachment' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, path, name } = destination;
	const [addingDetails, setAddingDetails] = useState(false);
	const detailPath = [...path, name];
	const fields = fieldNames(binding.text, keyPath(detailPath));
	const scalar = (title: string, keyName: string, integer = false) =>
		fields.has(keyName) ? (
			<ScalarField
				binding={binding}
				path={[...detailPath, keyName]}
				title={title}
				readOnly={readOnly}
				integer={integer}
			/>
		) : null;
	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={name}
				items={
					!readOnly
						? [
								{
									kind: 'menu',
									id: 'actions',
									icon: 'ellipsis',
									label: 'Actions',
									items: [
										{ id: 'add', title: 'Add configuration', onPress: () => setAddingDetails(true) }
									]
								}
							]
						: []
				}
			/>
			<Screen>
				{['ipv4_address', 'ipv6_address', 'mac_address', 'interface_name'].some((key) =>
					fields.has(key)
				) ? (
					<M3Section title="Addresses">
						{scalar('IPv4 address', 'ipv4_address')}
						{scalar('IPv6 address', 'ipv6_address')}
						{scalar('MAC address', 'mac_address')}
						{scalar('Interface name', 'interface_name')}
					</M3Section>
				) : null}
				{['aliases', 'priority', 'gw_priority'].some((key) => fields.has(key)) ? (
					<M3Section title="Options">
						{fields.has('aliases') ? (
							<NavRow
								title="Aliases"
								onPress={() =>
									push({
										screen: 'stringList',
										binding: destination.binding,
										path: [...detailPath, 'aliases'],
										title: 'Aliases',
										readOnly,
										allowsScalar: false,
										environmentFiles: false
									})
								}
							/>
						) : null}
						{scalar('Priority', 'priority', true)}
						{scalar('Gateway priority', 'gw_priority', true)}
					</M3Section>
				) : null}
				<M3Section>
					{fields.size === 0 ? (
						<EmptyRow icon="network" title="No attachment settings" />
					) : (
						<NavRow
							title="All network settings"
							onPress={() =>
								push(
									nativeFieldsDestination(
										destination.binding,
										detailPath,
										'Network settings',
										readOnly
									)
								)
							}
						/>
					)}
				</M3Section>
			</Screen>
			<AddFields
				binding={binding}
				visible={addingDetails}
				onClose={() => setAddingDetails(false)}
				options={{ fieldPath: keyPath(detailPath) }}
			/>
		</View>
	);
}

function ResourceListScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'resourceList' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, kind } = destination;
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState('');
	const [error, setError] = useState<string>();
	const names = (ComposeDocument.tryParse(binding.text)?.nativeFields([{ key: kind }]) ?? []).map(
		(field) => field.name
	);
	const title = kind === 'networks' ? 'Networks' : 'Named volumes';
	const icon = kind === 'networks' ? 'network' : 'externaldrive';
	const run = (action: () => string) => {
		if (readOnly) return false;
		try {
			binding.setText(action());
			setError(undefined);
			return true;
		} catch (caught) {
			setError(composeErrorMessage(caught));
			return false;
		}
	};
	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={title}
				items={
					!readOnly
						? [
								{
									kind: 'button',
									id: 'add',
									icon: 'plus',
									label: 'Add',
									onPress: () => {
										setName('');
										setError(undefined);
										setAdding(true);
									}
								}
							]
						: []
				}
			/>
			<Screen>
				<M3Section>
					{names.map((key, index) => (
						<LongPressMenu
							key={key}
							items={
								readOnly
									? []
									: deleteItem(() => run(() => removingResources(binding.text, kind, [index])))
							}
						>
							<NavRow
								title={key}
								icon={icon}
								onPress={() =>
									push({
										screen: 'resourceForm',
										binding: destination.binding,
										kind,
										name: key,
										readOnly
									})
								}
							/>
						</LongPressMenu>
					))}
					{names.length === 0 ? <EmptyRow icon={icon} title={`No ${title.toLowerCase()}`} /> : null}
					{!adding ? <ErrorText error={error} /> : null}
				</M3Section>
			</Screen>
			<FullScreenDialog
				visible={adding}
				title={kind === 'networks' ? 'Add network' : 'Add volume'}
				onClose={() => setAdding(false)}
				confirmTitle="Add"
				confirmDisabled={!/^[A-Za-z0-9_.-]+$/.test(name)}
				onConfirm={() => {
					if (run(() => addingResource(binding.text, kind, name))) setAdding(false);
				}}
			>
				<M3Section>
					<InlineInput value={name} onChangeText={setName} placeholder="Name" autoFocus />
					<ErrorText error={error} />
				</M3Section>
			</FullScreenDialog>
		</View>
	);
}

function ResourceFormScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'resourceForm' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, kind, name } = destination;
	const [adding, setAdding] = useState(false);
	const path = [kind, name];
	const fields = fieldNames(binding.text, keyPath(path));
	const any = (keys: string[]) => keys.some((key) => fields.has(key));
	const boolean = (title: string, keyName: string, defaultValue = false) =>
		fields.has(keyName) ? (
			<BooleanField
				binding={binding}
				path={[...path, keyName]}
				title={title}
				readOnly={readOnly}
				defaultValue={defaultValue}
			/>
		) : null;
	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title={name}
				items={
					!readOnly
						? [
								{
									kind: 'menu',
									id: 'actions',
									icon: 'ellipsis',
									label: 'Actions',
									items: [{ id: 'add', title: 'Add configuration', onPress: () => setAdding(true) }]
								}
							]
						: []
				}
			/>
			<Screen>
				{any(['name', 'external', 'driver']) ? (
					<M3Section title="Resource">
						{fields.has('name') ? (
							<ScalarField
								binding={binding}
								path={[...path, 'name']}
								title="Docker resource name"
								readOnly={readOnly}
							/>
						) : null}
						{boolean('External resource', 'external')}
						{fields.has('driver') ? (
							<ScalarField
								binding={binding}
								path={[...path, 'driver']}
								title="Driver"
								readOnly={readOnly}
							/>
						) : null}
					</M3Section>
				) : null}
				{kind === 'networks' &&
				any(['internal', 'attachable', 'enable_ipv4', 'enable_ipv6', 'ipam']) ? (
					<M3Section title="Network">
						{boolean('Internal', 'internal')}
						{boolean('Attachable', 'attachable')}
						{boolean('IPv4', 'enable_ipv4', true)}
						{boolean('IPv6', 'enable_ipv6')}
						{fields.has('ipam') ? (
							<NavRow
								title="IP address management"
								onPress={() =>
									push(
										nativeFieldsDestination(
											destination.binding,
											[...path, 'ipam'],
											'IP address management',
											readOnly
										)
									)
								}
							/>
						) : null}
					</M3Section>
				) : null}
				{any(['driver_opts', 'labels']) ? (
					<M3Section title="Options">
						{fields.has('driver_opts') ? (
							<NavRow
								title="Driver options"
								onPress={() =>
									push(
										nativeFieldsDestination(
											destination.binding,
											[...path, 'driver_opts'],
											'Driver options',
											readOnly
										)
									)
								}
							/>
						) : null}
						{fields.has('labels') ? (
							<NavRow
								title="Labels"
								onPress={() =>
									push(
										nativeFieldsDestination(
											destination.binding,
											[...path, 'labels'],
											'Labels',
											readOnly
										)
									)
								}
							/>
						) : null}
					</M3Section>
				) : null}
				<M3Section>
					{fields.size === 0 ? (
						<EmptyRow
							icon={kind === 'networks' ? 'network' : 'externaldrive'}
							title="No resource settings"
						/>
					) : (
						<NavRow
							title="All resource settings"
							onPress={() =>
								push(
									nativeFieldsDestination(destination.binding, path, 'Resource settings', readOnly)
								)
							}
						/>
					)}
				</M3Section>
			</Screen>
			<AddFields
				binding={binding}
				visible={adding}
				onClose={() => setAdding(false)}
				options={{ fieldPath: keyPath(path) }}
			/>
		</View>
	);
}

function EnvFileScreen({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'envFile' }>;
}) {
	const binding = useComposeBinding(destination.binding);
	const push = usePush();
	const { readOnly, schemaPath } = destination;
	const [adding, setAdding] = useState(false);
	const fields = fieldNames(binding.text, []);
	return (
		<View style={{ flex: 1 }}>
			<ScreenChrome
				title="Environment file"
				items={
					!readOnly
						? [
								{
									kind: 'menu',
									id: 'actions',
									icon: 'ellipsis',
									label: 'Actions',
									items: [{ id: 'add', title: 'Add configuration', onPress: () => setAdding(true) }]
								}
							]
						: []
				}
			/>
			<Screen>
				<M3Section>
					{fields.has('path') ? (
						<ScalarField binding={binding} path={['path']} title="Path" readOnly={readOnly} />
					) : null}
					{fields.has('required') ? (
						<BooleanField
							binding={binding}
							path={['required']}
							title="Required"
							readOnly={readOnly}
							defaultValue
						/>
					) : null}
					{fields.has('format') ? (
						<ScalarField binding={binding} path={['format']} title="Format" readOnly={readOnly} />
					) : null}
					{fields.size === 0 ? (
						<EmptyRow icon="doc.text" title="No environment file settings" />
					) : (
						<>
							<Divider />
							<NavRow
								title="All file settings"
								onPress={() =>
									push(
										nativeFieldsDestination(
											destination.binding,
											[],
											'Environment file settings',
											readOnly,
											[],
											schemaPath
										)
									)
								}
							/>
						</>
					)}
				</M3Section>
			</Screen>
			<AddFields
				binding={binding}
				visible={adding}
				onClose={() => setAdding(false)}
				options={{ fieldPath: [], schemaPath }}
			/>
		</View>
	);
}

export function ComposeDestinationScreen({ destination }: { destination: ComposeDestination }) {
	switch (destination.screen) {
		case 'editor':
			return <EditorScreen destination={destination} />;
		case 'envEditor':
			return <EnvEditorScreen destination={destination} />;
		case 'service':
			return <ServiceScreen destination={destination} />;
		case 'imageSettings':
		case 'runtime':
		case 'identity':
		case 'nameResolution':
		case 'pullPolicy':
			return <ServiceSubScreen destination={destination} />;
		case 'nativeFields':
			return <NativeFieldsScreen destination={destination} />;
		case 'mapping':
			return <MappingScreen destination={destination} />;
		case 'collection':
			return <CollectionScreen destination={destination} />;
		case 'stringList':
			return <StringListScreen destination={destination} />;
		case 'healthcheck':
			return <HealthcheckScreen destination={destination} />;
		case 'networkAttachments':
			return <NetworkAttachmentsScreen destination={destination} />;
		case 'networkAttachment':
			return <NetworkAttachmentScreen destination={destination} />;
		case 'resourceList':
			return <ResourceListScreen destination={destination} />;
		case 'resourceForm':
			return <ResourceFormScreen destination={destination} />;
		case 'envFile':
			return <EnvFileScreen destination={destination} />;
	}
}

export function DialogStack({ root }: { root: ComposeDestination }) {
	const [stack, setStack] = useState<ComposeDestination[]>([]);
	const top = stack[stack.length - 1] ?? root;
	const back = stack.length > 0 ? () => setStack((current) => current.slice(0, -1)) : undefined;
	useEffect(() => {
		if (!back) return;
		const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
			back();
			return true;
		});
		return () => subscription.remove();
	}, [back]);
	return (
		<ComposeNavigationContext.Provider
			value={{
				push: (destination) => setStack((current) => [...current, destination]),
				mode: 'dialog',
				back
			}}
		>
			<ComposeDestinationScreen key={stack.length} destination={top} />
		</ComposeNavigationContext.Provider>
	);
}
