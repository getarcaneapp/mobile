import {
	Button,
	Form,
	HStack,
	ScrollView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	background,
	buttonStyle,
	contentShape,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	multilineTextAlignment,
	navigationTitle,
	padding,
	shapes,
	tag,
	textSelection,
	type ModifierConfig
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { Image } from '@/ui/components/swiftui-image';

import { policyOptions, ServiceFormModel, settingPolicy } from '../compose-actions';
import { nativeFieldsDestination, type ComposeDestination } from '../compose-destinations';
import {
	useComposeBinding,
	useComposeMenuActions,
	type ComposeBindingRef
} from '../compose-session';
import { composeErrorMessage } from '../model/compose-errors';
import { capitalized } from '../model/compose-field-options';
import { ComposeScalarField } from './compose-forms.ios';
import { ComposeAddFieldsSheet } from './compose-native-fields.ios';
import {
	MenuPicker,
	chevron,
	ComposeLink,
	EllipsisMenu,
	ErrorText,
	MenuActionItems,
	plainTextInput,
	secondaryStyle,
	TitleLink
} from './compose-ui.ios';

type ServiceDestination = Extract<ComposeDestination, { screen: 'service' }>;
type SubformDestination = Extract<
	ComposeDestination,
	{ screen: 'imageSettings' | 'runtime' | 'identity' | 'nameResolution' | 'pullPolicy' }
>;

const groupedCard = (radius: number): ModifierConfig =>
	background(
		colors.secondarySystemGroupedBackground,
		shapes.roundedRectangle({ cornerRadius: radius, roundedCornerStyle: 'continuous' })
	);

export function ComposeServiceForm({ destination }: { destination: ServiceDestination }) {
	const { binding: bindingRef, readOnly, service } = destination;
	const binding = useComposeBinding(bindingRef);
	const menuActions = useComposeMenuActions(bindingRef.session);
	const accent = useAccentColor();
	const [addingFields, setAddingFields] = useState(false);
	const model = new ServiceFormModel(binding.text, service);
	const path = model.path;
	const has = (key: string) => model.has(key);
	const sub = (screen: SubformDestination['screen']): SubformDestination => ({
		screen,
		binding: bindingRef,
		readOnly,
		service
	});
	const strings = (key: string, title: string, allowsScalar = true): ComposeDestination => ({
		screen: 'stringList',
		binding: bindingRef,
		readOnly,
		path: [...path, key],
		title,
		allowsScalar,
		environmentFiles: key === 'env_file'
	});

	const tiles: ReactNode[] = [];
	if (has('ports')) {
		tiles.push(
			<Tile
				key="ports"
				title="Ports"
				icon="arrow.left.arrow.right"
				tint={systemColors.blue}
				summary={model.countSummary('ports', 'port', 'ports')}
				destination={{
					screen: 'collection',
					binding: bindingRef,
					readOnly,
					path: [...path, 'ports'],
					title: 'Ports',
					kind: 'port'
				}}
			/>
		);
	}
	if (has('volumes')) {
		tiles.push(
			<Tile
				key="volumes"
				title="Mounts"
				icon="externaldrive"
				tint={systemColors.orange}
				summary={model.countSummary('volumes', 'mount', 'mounts')}
				destination={{
					screen: 'collection',
					binding: bindingRef,
					readOnly,
					path: [...path, 'volumes'],
					title: 'Mounts',
					kind: 'mount'
				}}
			/>
		);
	}
	if (has('networks')) {
		tiles.push(
			<Tile
				key="networks"
				title="Networks"
				icon="network"
				tint={systemColors.teal}
				summary={model.countSummary('networks', 'attachment', 'attachments')}
				destination={{
					screen: 'networkAttachments',
					binding: bindingRef,
					readOnly,
					path: [...path, 'networks']
				}}
			/>
		);
	}
	if (has('environment')) {
		tiles.push(
			<Tile
				key="environment"
				title="Environment"
				icon="key.horizontal"
				tint={systemColors.purple}
				summary={model.countSummary('environment', 'variable', 'variables')}
				destination={{
					screen: 'mapping',
					binding: bindingRef,
					readOnly,
					path: [...path, 'environment'],
					title: 'Environment variables',
					resource: false,
					sensitive: true
				}}
			/>
		);
	}
	if (has('env_file')) {
		tiles.push(
			<Tile
				key="env_file"
				title="Environment files"
				icon="doc.text"
				tint={systemColors.indigo}
				summary={model.countSummary('env_file', 'file', 'files')}
				destination={strings('env_file', 'Environment files')}
			/>
		);
	}
	if (has('labels')) {
		tiles.push(
			<Tile
				key="labels"
				title="Labels"
				icon="tag"
				tint={systemColors.brown}
				summary={model.countSummary('labels', 'label', 'labels')}
				destination={{
					screen: 'mapping',
					binding: bindingRef,
					readOnly,
					path: [...path, 'labels'],
					title: 'Labels',
					resource: false,
					sensitive: true
				}}
			/>
		);
	}
	const tileRows: ReactNode[] = [];
	for (let i = 0; i < tiles.length; i += 2) {
		tileRows.push(
			<HStack key={i} alignment="top" spacing={12}>
				{tiles[i]}
				{tiles[i + 1] ?? <Spacer modifiers={[frame({ maxWidth: Infinity })]} />}
			</HStack>
		);
	}

	return (
		<Toolbar>
			<VStack spacing={0}>
				<ScrollView
					modifiers={[
						background(colors.systemGroupedBackground),
						navigationTitle(service),
						...plainTextInput
					]}
				>
					<VStack alignment="leading" spacing={20} modifiers={[padding({ all: 16 })]}>
						{has('image') ? (
							<ComposeLink destination={sub('imageSettings')} modifiers={[buttonStyle('plain')]}>
								<HStack
									alignment="top"
									spacing={14}
									modifiers={[
										padding({ all: 18 }),
										frame({ maxWidth: Infinity, alignment: 'leading' }),
										groupedCard(Radius.card)
									]}
								>
									<Image
										systemName="shippingbox.fill"
										modifiers={[
											font({ textStyle: 'title2' }),
											foregroundStyle(accent),
											padding({ all: 12 }),
											background(
												withOpacity(accent, 0.09),
												shapes.roundedRectangle({
													cornerRadius: Radius.nested,
													roundedCornerStyle: 'continuous'
												})
											)
										]}
									/>
									<VStack alignment="leading" spacing={6}>
										<Text modifiers={[font({ textStyle: 'subheadline' }), secondaryStyle]}>
											Container image
										</Text>
										<Text
											modifiers={[
												font({ textStyle: 'headline' }),
												foregroundStyle('primary'),
												multilineTextAlignment('leading'),
												textSelection(true)
											]}
										>
											{model.value('image') ?? 'Choose an image'}
										</Text>
										{has('pull_policy') ? (
											<Text modifiers={[font({ textStyle: 'caption' }), secondaryStyle]}>
												{'Pull policy: ' + (model.value('pull_policy') ?? 'Default')}
											</Text>
										) : null}
									</VStack>
									<Spacer minLength={0} />
									{chevron()}
								</HStack>
							</ComposeLink>
						) : null}

						{tiles.length > 0 ? (
							<VStack alignment="leading" spacing={10}>
								<Text modifiers={[font({ textStyle: 'headline' })]}>Configuration</Text>
								<VStack alignment="leading" spacing={12}>
									{tileRows}
								</VStack>
							</VStack>
						) : null}

						{has('healthcheck') ? (
							<VStack spacing={0} modifiers={[groupedCard(Radius.standard)]}>
								<Route
									title="Healthcheck"
									icon="heart.text.clipboard"
									summary={model.healthcheckSummary}
									destination={{
										screen: 'healthcheck',
										binding: bindingRef,
										readOnly,
										path: [...path, 'healthcheck']
									}}
								/>
							</VStack>
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
							<VStack spacing={0} modifiers={[groupedCard(Radius.standard)]}>
								{model.hasAny(['restart', 'command', 'entrypoint']) ? (
									<Route
										title="Runtime"
										icon="terminal"
										summary={model.runtimeSummary}
										destination={sub('runtime')}
									/>
								) : null}
								{model.hasAny(['container_name', 'hostname', 'domainname']) ? (
									<Route
										title="Identity"
										icon="person.text.rectangle"
										summary={model.identitySummary}
										destination={sub('identity')}
									/>
								) : null}
								{model.hasAny(['extra_hosts', 'dns', 'dns_opt', 'dns_search']) ? (
									<Route
										title="Name resolution"
										icon="globe"
										summary="DNS and host mappings"
										destination={sub('nameResolution')}
									/>
								) : null}
							</VStack>
						) : null}

						{has('x-arcane') ? (
							<Route
								title="Arcane metadata"
								icon="square.stack.3d.up.fill"
								summary="Icons, visibility and updates"
								destination={nativeFieldsDestination(
									bindingRef,
									[...path, 'x-arcane'],
									'Arcane metadata',
									readOnly
								)}
							/>
						) : null}
						{model.additionalFields.length > 0 ? (
							<VStack alignment="leading" spacing={8}>
								<Text modifiers={[font({ textStyle: 'headline' })]}>Additional settings</Text>
								<VStack spacing={0} modifiers={[groupedCard(Radius.standard)]}>
									{model.additionalFields.map((key) => (
										<Route
											key={key}
											title={capitalized(key.replace(/_/g, ' '))}
											icon="slider.horizontal.3"
											summary="Configured"
											destination={nativeFieldsDestination(
												bindingRef,
												[...path, key],
												key,
												readOnly
											)}
										/>
									))}
								</VStack>
							</VStack>
						) : null}
						{has('pull_policy') && !has('image') ? (
							<Route
								title="Pull policy"
								icon="arrow.down.circle"
								summary={model.value('pull_policy') ?? 'Default'}
								destination={sub('pullPolicy')}
							/>
						) : null}
						{model.existingFields.size > 0 ? (
							<Route
								title="All service settings"
								icon="slider.horizontal.3"
								summary="Browse every configuration field"
								destination={nativeFieldsDestination(
									bindingRef,
									path,
									'Service settings',
									readOnly
								)}
							/>
						) : null}
					</VStack>
				</ScrollView>
				<ComposeAddFieldsSheet
					isPresented={addingFields}
					onDismiss={() => setAddingFields(false)}
					bindingRef={bindingRef}
					fieldPath={path.map((key) => ({ key }))}
				/>
			</VStack>
			<Toolbar.Content>
				{!readOnly || menuActions !== undefined ? (
					<ToolbarItem placement="topBarTrailing">
						<EllipsisMenu label="Service actions">
							{!readOnly ? (
								<Button
									label="Add configuration"
									systemImage="plus"
									onPress={() => setAddingFields(true)}
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

function Tile({
	title,
	icon,
	tint,
	summary,
	destination
}: {
	title: string;
	icon: string;
	tint: string;
	summary: string;
	destination: ComposeDestination;
}) {
	return (
		<ComposeLink
			destination={destination}
			modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity })]}
		>
			<VStack
				alignment="leading"
				spacing={12}
				modifiers={[
					padding({ all: 16 }),
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					groupedCard(Radius.card)
				]}
			>
				<HStack>
					<Image
						systemName={icon as SFSymbol}
						modifiers={[
							font({ textStyle: 'title3' }),
							foregroundStyle(tint),
							frame({ height: 28 })
						]}
					/>
					<Spacer />
					{chevron()}
				</HStack>
				<VStack alignment="leading" spacing={4}>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline', weight: 'semibold' }),
							foregroundStyle('primary')
						]}
					>
						{title}
					</Text>
					<Text modifiers={[font({ textStyle: 'caption' }), secondaryStyle]}>{summary}</Text>
				</VStack>
			</VStack>
		</ComposeLink>
	);
}

function Route({
	title,
	icon,
	summary,
	destination
}: {
	title: string;
	icon: string;
	summary: string;
	destination: ComposeDestination;
}) {
	return (
		<ComposeLink destination={destination} modifiers={[buttonStyle('plain')]}>
			<HStack
				spacing={12}
				modifiers={[
					padding({ all: 14 }),
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					contentShape(shapes.rectangle())
				]}
			>
				<Image
					systemName={icon as SFSymbol}
					modifiers={[font({ textStyle: 'body' }), secondaryStyle, frame({ width: 22 })]}
				/>
				<VStack alignment="leading" spacing={3}>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline', weight: 'medium' }),
							foregroundStyle('primary')
						]}
					>
						{title}
					</Text>
					<Text modifiers={[font({ textStyle: 'caption' }), secondaryStyle, lineLimit(2)]}>
						{summary}
					</Text>
				</VStack>
				<Spacer minLength={8} />
				{chevron()}
			</HStack>
		</ComposeLink>
	);
}

function PolicyPicker({
	bindingRef,
	path,
	title,
	keyName,
	readOnly,
	onError
}: {
	bindingRef: ComposeBindingRef;
	path: string[];
	title: string;
	keyName: string;
	readOnly: boolean;
	onError: (error?: string) => void;
}) {
	const binding = useComposeBinding(bindingRef);
	const { options, current, custom } = policyOptions(binding.text, path, keyName);
	return (
		<MenuPicker
			label={title}
			selection={current}
			onSelectionChange={(selected: string) => {
				try {
					binding.setText(settingPolicy(binding.text, path, keyName, selected));
					onError(undefined);
				} catch (caught) {
					onError(composeErrorMessage(caught));
				}
			}}
			modifiers={[disabled(readOnly)]}
		>
			<Text modifiers={[tag('')]}>Default</Text>
			{options.values.map((value) => (
				<Text key={value} modifiers={[tag(value)]}>
					{options.label(value)}
				</Text>
			))}
			{custom ? <Text modifiers={[tag(current)]}>{'Custom: ' + current}</Text> : null}
		</MenuPicker>
	);
}

export function ServiceSubform({ destination }: { destination: SubformDestination }) {
	const { binding: bindingRef, readOnly, service } = destination;
	const binding = useComposeBinding(bindingRef);
	const [error, setError] = useState<string>();
	const model = new ServiceFormModel(binding.text, service);
	const path = model.path;
	const has = (key: string) => model.has(key);
	const scalar = (title: string, key: string) => (
		<ComposeScalarField
			key={key}
			bindingRef={bindingRef}
			path={[...path, key]}
			title={title}
			readOnly={readOnly}
		/>
	);
	const policy = (title: string, key: string) => (
		<PolicyPicker
			bindingRef={bindingRef}
			path={path}
			title={title}
			keyName={key}
			readOnly={readOnly}
			onError={setError}
		/>
	);
	const strings = (key: string, title: string, allowsScalar = true): ComposeDestination => ({
		screen: 'stringList',
		binding: bindingRef,
		readOnly,
		path: [...path, key],
		title,
		allowsScalar,
		environmentFiles: key === 'env_file'
	});

	switch (destination.screen) {
		case 'imageSettings':
			return (
				<Form modifiers={[navigationTitle('Image settings'), ...plainTextInput]}>
					<Section title="Image">{scalar('Image', 'image')}</Section>
					{has('pull_policy') ? <Section>{policy('Pull policy', 'pull_policy')}</Section> : null}
					<ErrorText error={error} />
				</Form>
			);
		case 'runtime':
			return (
				<Form modifiers={[navigationTitle('Runtime'), ...plainTextInput]}>
					{has('restart') ? <Section>{policy('Restart policy', 'restart')}</Section> : null}
					<ErrorText error={error} />
					<Section>
						{has('command') ? (
							<TitleLink title="Command" destination={strings('command', 'Command')} />
						) : null}
						{has('entrypoint') ? (
							<TitleLink title="Entrypoint" destination={strings('entrypoint', 'Entrypoint')} />
						) : null}
					</Section>
				</Form>
			);
		case 'identity':
			return (
				<Form modifiers={[navigationTitle('Identity'), ...plainTextInput]}>
					{has('container_name') ? scalar('Container name', 'container_name') : null}
					{has('hostname') ? scalar('Hostname', 'hostname') : null}
					{has('domainname') ? scalar('Domain name', 'domainname') : null}
				</Form>
			);
		case 'nameResolution':
			return (
				<Form modifiers={[navigationTitle('Name resolution'), ...plainTextInput]}>
					{has('extra_hosts') ? (
						<TitleLink
							title="Extra hosts"
							destination={
								model.isSequence('extra_hosts')
									? strings('extra_hosts', 'Extra hosts', false)
									: {
											screen: 'mapping',
											binding: bindingRef,
											readOnly,
											path: [...path, 'extra_hosts'],
											title: 'Extra hosts',
											resource: false,
											sensitive: false
										}
							}
						/>
					) : null}
					{has('dns') ? (
						<TitleLink title="DNS servers" destination={strings('dns', 'DNS servers')} />
					) : null}
					{has('dns_opt') ? (
						<TitleLink title="DNS options" destination={strings('dns_opt', 'DNS options')} />
					) : null}
					{has('dns_search') ? (
						<TitleLink
							title="DNS search domains"
							destination={strings('dns_search', 'DNS search domains')}
						/>
					) : null}
				</Form>
			);
		case 'pullPolicy':
			return (
				<Form modifiers={[navigationTitle('Pull policy'), ...plainTextInput]}>
					{policy('Pull policy', 'pull_policy')}
				</Form>
			);
	}
}
