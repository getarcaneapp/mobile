import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	Form,
	HStack,
	List,
	RNHostView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	ZStack
} from '@expo/ui/swift-ui';
import {
	accessibilityHidden,
	accessibilityLabel,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listRowBackground,
	navigationBarTitleDisplayMode,
	navigationTitle,
	opacity,
	padding,
	privacySensitive,
	tint,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { CodeEditor, type CodeEditorLanguage } from '@/ui/components/code-editor';
import { DestructiveLabel } from '@/ui/components/labels';
import { RowIcon } from '@/ui/components/row-icon';
import { ScrollableTabBarContent } from '@/ui/components/scrollable-tab-bar';
import { UnavailableView } from '@/ui/components/unavailable-view';

import {
	parseError,
	projectResourceKeys,
	removingServices,
	resourceSummary,
	serviceImage,
	settingEnvValue
} from '../compose-actions';
import { nativeFieldsDestination, type ComposeDestination } from '../compose-destinations';
import {
	useComposeBinding,
	useComposeMenuActions,
	type ComposeBinding,
	type ComposeBindingRef
} from '../compose-session';
import { ComposeDocument } from '../model/compose-document';
import { composeErrorMessage } from '../model/compose-errors';
import { EnvDocument, type EnvEntry } from '../model/env-document';
import { ComposeNameSheet } from './compose-forms.ios';
import { ComposeAddFieldsSheet } from './compose-native-fields.ios';
import {
	DeletableSection,
	RowsForEach,
	BoundField,
	ComposeLink,
	DynamicLinkRow,
	EllipsisMenu,
	ErrorText,
	MenuActionItems,
	plainTextInput,
	secondaryStyle
} from './compose-ui.ios';

type Mode = 'editor' | 'yaml';

function ModeContent({
	showsSource,
	source,
	children
}: {
	showsSource: boolean;
	source: ReactNode;
	children: ReactNode;
}) {
	return (
		<ZStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
			<ZStack
				modifiers={[
					opacity(showsSource ? 1 : 0),
					disabled(!showsSource),
					accessibilityHidden(!showsSource)
				]}
			>
				{source}
			</ZStack>
			{showsSource ? null : children}
		</ZStack>
	);
}

function SourceEditor({
	binding,
	language,
	readOnly
}: {
	binding: ComposeBinding;
	language: CodeEditorLanguage;
	readOnly: boolean;
}) {
	return (
		<ZStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
			<RNHostView>
				<View style={{ flex: 1 }}>
					<CodeEditor
						text={binding.text}
						onChangeText={binding.setText}
						language={language}
						readOnly={readOnly}
					/>
				</View>
			</RNHostView>
		</ZStack>
	);
}

function titleModifiers(title: string) {
	return title === '' ? [] : [navigationTitle(title), navigationBarTitleDisplayMode('inline')];
}

export function ComposePreviewEditor({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'editor' }>;
}) {
	return (
		<ComposePreviewEditorView
			bindingRef={destination.binding}
			readOnly={destination.readOnly}
			title={destination.title}
		/>
	);
}

export function ComposePreviewEditorView({
	bindingRef,
	readOnly,
	title = ''
}: {
	bindingRef: ComposeBindingRef;
	readOnly: boolean;
	title?: string;
}) {
	const binding = useComposeBinding(bindingRef);
	const menuActions = useComposeMenuActions(bindingRef.session);
	const [mode, setMode] = useState<Mode>('editor');
	const [addingConfiguration, setAddingConfiguration] = useState(false);
	const [error, setError] = useState<string>();
	const document = ComposeDocument.tryParse(binding.text);
	const yaml = mode === 'yaml';

	const mutate = (change: () => string) => {
		try {
			binding.setText(change());
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};

	const showsMenu = yaml ? menuActions !== undefined : menuActions !== undefined || !readOnly;

	return (
		<Toolbar>
			<VStack spacing={0} modifiers={titleModifiers(title)}>
				<ScrollableTabBarContent
					selection={mode}
					onSelectionChange={setMode}
					options={[
						{ value: 'editor', title: 'Editor', systemImage: 'slider.horizontal.3' },
						{ value: 'yaml', title: 'YAML', systemImage: 'chevron.left.forwardslash.chevron.right' }
					]}
					accessibilityLabel="Compose editor mode"
				/>
				<ModeContent
					showsSource={yaml}
					source={<SourceEditor binding={binding} language="yaml" readOnly={readOnly} />}
				>
					{document ? (
						<ServiceList
							document={document}
							bindingRef={bindingRef}
							readOnly={readOnly}
							mutate={mutate}
						/>
					) : (
						<UnavailableView
							title="Open YAML to continue"
							systemImage="doc.text"
							description={parseError(binding.text)}
							actions={[{ title: 'Edit YAML', onPress: () => setMode('yaml') }]}
						/>
					)}
				</ModeContent>
				{error !== undefined ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle(systemColors.red),
							padding({ all: 16 })
						]}
					>
						{error}
					</Text>
				) : null}
				<ComposeAddFieldsSheet
					isPresented={addingConfiguration}
					onDismiss={() => setAddingConfiguration(false)}
					bindingRef={bindingRef}
					fieldPath={[]}
					includesProjectSettings
				/>
			</VStack>
			<Toolbar.Content>
				{showsMenu ? (
					<ToolbarItem placement="topBarTrailing">
						<EllipsisMenu label="Editor actions">
							{!readOnly && !yaml ? (
								<Button
									label="Add configuration"
									systemImage="slider.horizontal.3"
									onPress={() => setAddingConfiguration(true)}
								/>
							) : null}
							<MenuActionItems actions={menuActions} />
						</EllipsisMenu>
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}

function ServiceList({
	document,
	bindingRef,
	readOnly,
	mutate
}: {
	document: ComposeDocument;
	bindingRef: ComposeBindingRef;
	readOnly: boolean;
	mutate: (change: () => string) => void;
}) {
	const services = document.services;
	const rootFields = new Set(document.nativeFields([]).map((field) => field.name));
	const otherRootFields = document
		.nativeFields([])
		.filter((field) => !projectResourceKeys.includes(field.name));
	const text = document.source;

	const rows = services.map((service) => (
		<ContextMenu key={service}>
			<ContextMenu.Trigger>
				<ComposeLink
					destination={{ screen: 'service', binding: bindingRef, readOnly, service, menu: true }}
				>
					<ServiceRow service={service} image={serviceImage(document, service)} />
				</ComposeLink>
			</ContextMenu.Trigger>
			<ContextMenu.Items>
				{!readOnly ? (
					<Button
						role="destructive"
						onPress={() => mutate(() => removingServices(text, [service]))}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete" />
					</Button>
				) : null}
			</ContextMenu.Items>
		</ContextMenu>
	));

	return (
		<List modifiers={plainTextInput}>
			<Section
				header={
					<HStack>
						<Text>Services</Text>
						<Spacer />
						<Text modifiers={[font({ textStyle: 'caption2' })]}>Preview</Text>
					</HStack>
				}
			>
				{readOnly ? (
					rows
				) : (
					<RowsForEach
						onDelete={(indices) =>
							mutate(() =>
								removingServices(
									text,
									indices.map((index) => services[index]!)
								)
							)
						}
					>
						{rows}
					</RowsForEach>
				)}
				{services.length === 0 ? (
					<ContentUnavailableView
						title="No services"
						systemImage="square.stack.3d.up"
						description="Add a service to configure its container."
					/>
				) : null}
			</Section>
			{rootFields.has('volumes') || rootFields.has('networks') ? (
				<Section title="Project resources">
					{rootFields.has('volumes') ? (
						<DynamicLinkRow
							title="Named volumes"
							subtitle={resourceSummary(document, 'volumes')}
							systemImage="externaldrive.fill"
							destination={{
								screen: 'resourceList',
								binding: bindingRef,
								readOnly,
								kind: 'volumes'
							}}
						/>
					) : null}
					{rootFields.has('networks') ? (
						<DynamicLinkRow
							title="Networks"
							subtitle={resourceSummary(document, 'networks')}
							systemImage="network"
							destination={{
								screen: 'resourceList',
								binding: bindingRef,
								readOnly,
								kind: 'networks'
							}}
						/>
					) : null}
				</Section>
			) : null}
			{rootFields.has('x-arcane') ? (
				<Section>
					<DynamicLinkRow
						title="Arcane metadata"
						subtitle="Icons, visibility, links and updates"
						systemImage="square.stack.3d.up.fill"
						destination={nativeFieldsDestination(
							bindingRef,
							['x-arcane'],
							'Arcane metadata',
							readOnly
						)}
					/>
				</Section>
			) : null}
			{otherRootFields.length > 0 ? (
				<Section>
					<DynamicLinkRow
						title="Project settings"
						subtitle={otherRootFields.map((field) => field.name).join(', ')}
						systemImage="slider.horizontal.3"
						destination={nativeFieldsDestination(
							bindingRef,
							[],
							'Project settings',
							readOnly,
							projectResourceKeys
						)}
					/>
				</Section>
			) : null}
		</List>
	);
}

function ServiceRow({ service, image }: { service: string; image?: string }) {
	return (
		<HStack spacing={12}>
			<RowIcon systemImage="cube.box.fill" tint={systemColors.orange} />
			<VStack alignment="leading" spacing={4} modifiers={[padding({ vertical: 6 })]}>
				<Text modifiers={[font({ textStyle: 'headline' }), foregroundStyle('primary')]}>
					{service}
				</Text>
				{image !== undefined ? (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							secondaryStyle,
							lineLimit(2),
							truncationMode('middle')
						]}
					>
						{image}
					</Text>
				) : null}
			</VStack>
		</HStack>
	);
}

export function EnvPreviewEditor({
	destination
}: {
	destination: Extract<ComposeDestination, { screen: 'envEditor' }>;
}) {
	return (
		<EnvPreviewEditorView
			bindingRef={destination.binding}
			readOnly={destination.readOnly}
			title={destination.title}
		/>
	);
}

export function EnvPreviewEditorView({
	bindingRef,
	readOnly,
	title = ''
}: {
	bindingRef: ComposeBindingRef;
	readOnly: boolean;
	title?: string;
}) {
	const binding = useComposeBinding(bindingRef);
	const menuActions = useComposeMenuActions(bindingRef.session);
	const [mode, setMode] = useState<'editor' | 'text'>('editor');
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string>();
	const document = new EnvDocument(binding.text);
	const raw = mode === 'text';

	const toggleReveal = (name: string) =>
		setRevealed((current) => {
			const next = new Set(current);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	const setValue = (entry: EnvEntry, value: string) => {
		try {
			binding.setText(settingEnvValue(binding.text, entry, value));
			setError(undefined);
		} catch (caught) {
			setError(composeErrorMessage(caught));
		}
	};

	const sections = document.entries.map((entry) => (
		<DeletableSection
			key={`${entry.line}-${entry.name}`}
			title={entry.name}
			readOnly={readOnly}
			onDelete={() => binding.setText(new EnvDocument(binding.text).removing(entry))}
		>
			<HStack modifiers={[privacySensitive(true), disabled(readOnly)]}>
				<BoundField
					placeholder="Value"
					value={entry.value}
					onChange={(value) => setValue(entry, value)}
					secure={!revealed.has(entry.name)}
					modifiers={[accessibilityLabel(entry.name)]}
				/>
				<Button
					label={revealed.has(entry.name) ? 'Hide' : 'Reveal'}
					onPress={() => toggleReveal(entry.name)}
					modifiers={[
						accessibilityLabel(`${revealed.has(entry.name) ? 'Hide' : 'Reveal'} ${entry.name}`)
					]}
				/>
			</HStack>
		</DeletableSection>
	));

	return (
		<Toolbar>
			<VStack spacing={0} modifiers={titleModifiers(title)}>
				<ScrollableTabBarContent
					selection={mode}
					onSelectionChange={setMode}
					options={[
						{ value: 'editor', title: 'Editor', systemImage: 'slider.horizontal.3' },
						{ value: 'text', title: 'Text', systemImage: 'chevron.left.forwardslash.chevron.right' }
					]}
					accessibilityLabel="Environment editor mode"
				/>
				<ModeContent
					showsSource={raw}
					source={<SourceEditor binding={binding} language="env" readOnly={readOnly} />}
				>
					<Form modifiers={plainTextInput}>
						<Section>
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									secondaryStyle,
									listRowBackground('#00000000')
								]}
							>
								Preview
							</Text>
						</Section>
						{sections}
						{document.entries.length === 0 ? (
							<ContentUnavailableView
								title="No environment variables"
								systemImage="list.bullet"
								description="Use Add to create a variable."
							/>
						) : null}
						{document.unsupportedLines > 0 ? (
							<Section>
								<Text>{'Unsupported entries: ' + String(document.unsupportedLines)}</Text>
								<Button label="Open text editor" onPress={() => setMode('text')} />
							</Section>
						) : null}
						<ErrorText error={error} />
					</Form>
				</ModeContent>
				<ComposeNameSheet
					isPresented={adding}
					onDismiss={() => setAdding(false)}
					title="Add variable"
					placeholder="Variable name"
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
			</VStack>
			<Toolbar.Content>
				{menuActions !== undefined || (!readOnly && !raw) ? (
					<ToolbarItem placement="topBarTrailing">
						<EllipsisMenu label="Editor actions">
							{!readOnly && !raw ? (
								<Button label="Add variable" systemImage="plus" onPress={() => setAdding(true)} />
							) : null}
							<MenuActionItems actions={menuActions} />
						</EllipsisMenu>
					</ToolbarItem>
				) : null}
			</Toolbar.Content>
		</Toolbar>
	);
}
