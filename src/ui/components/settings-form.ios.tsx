import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	Form,
	HStack,
	Label,
	LabeledContent,
	List,
	Section,
	Spacer,
	Text,
	Toggle,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	buttonStyle,
	contentShape,
	disabled as disabledModifier,
	font,
	foregroundStyle,
	refreshable,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAccentColor } from '@/theme/accent';
import { colors, systemColors } from '@/theme/colors';
import { DisclosureChevron } from '@/ui/settings-row';

import { ArcaneLoadingView } from './arcane-loading-view';
import { FormNumberField, FormPicker, FormSecureField, FormTextField } from './form-fields';
import {
	useDraft,
	isFieldVisible,
	registeredSettingsDraft,
	settingLockCaption,
	type EnvironmentSettingsDraft
} from './settings-form-draft';
import {
	useOpenContainerMultiSelect,
	type ContainerMultiSelectParams
} from './settings-form-navigation';
import {
	SettingsSaveBar,
	SettingsSaveBarSpacer
} from '@/features/settings/shared/settings-save-bar';
import {
	containerSelectRows,
	excludedCountLabel,
	filterContainerSelectRows,
	networkOptions,
	optionLabel,
	rangeHint,
	selectedContainerNames,
	settingBool,
	toggleContainerSelection,
	type SettingFieldDef,
	type SettingsCategoryDef,
	type SettingsSectionDef
} from './settings-form.types';
import { useSettingsCategory } from './use-settings-category';

type SettingFieldRowProps = {
	field: SettingFieldDef;
	draft: EnvironmentSettingsDraft;
	onOpenContainerSelect: (field: SettingFieldDef) => void;
};

export function SettingFieldRow(props: SettingFieldRowProps) {
	const lockCaption = useDraft(props.draft, (s) => settingLockCaption(s.locks[props.field.key]));
	if (lockCaption === undefined) return <SettingFieldControl {...props} />;
	return (
		<VStack alignment="leading" spacing={6} modifiers={[disabledModifier(true)]}>
			<SettingFieldControl {...props} />
			<Label
				title={lockCaption}
				systemImage="lock.fill"
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			/>
		</VStack>
	);
}

function SettingFieldControl({ field, draft, onOpenContainerSelect }: SettingFieldRowProps) {
	const value = useDraft(draft, (s) => s.values[field.key] ?? '');
	const networkNames = useDraft(draft, (s) => s.networkNames);
	const setValue = (next: string) => draft.getState().setValue(field.key, next);
	const type = field.type;

	switch (type.kind) {
		case 'boolean':
			return (
				<Toggle isOn={settingBool(value)} onIsOnChange={(isOn) => setValue(String(isOn))}>
					<VStack alignment="leading" spacing={2}>
						<Text>{field.label}</Text>
						{field.description ? (
							<Text
								modifiers={[
									font({ textStyle: 'caption' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{field.description}
							</Text>
						) : null}
					</VStack>
				</Toggle>
			);
		case 'number':
			return (
				<FormNumberField
					title={field.label}
					placeholder="0"
					text={value}
					onChangeText={setValue}
					minValue={field.minValue}
					maxValue={field.maxValue}
					helper={rangeHint(field)}
				/>
			);
		case 'password':
			return (
				<FormSecureField
					title={field.label}
					placeholder="Secret value"
					text={value}
					onChangeText={setValue}
					helper={field.description}
				/>
			);
		case 'select': {
			const selection = type.options.includes(value) ? value : (type.options[0] ?? '');
			return (
				<FormPicker
					title={field.label}
					selection={selection}
					onSelectionChange={setValue}
					options={type.options.map((option) => ({ label: optionLabel(option), value: option }))}
					helper={field.description}
				/>
			);
		}
		case 'networkSelect':
			return (
				<FormPicker
					title={field.label}
					selection={value}
					onSelectionChange={setValue}
					options={networkOptions(networkNames, value).map((option) => ({
						label: option === '' ? 'Auto' : option,
						value: option
					}))}
					helper={field.description}
				/>
			);
		case 'cron':
		case 'text':
		case 'textarea': {
			const isMultiline = type.kind === 'textarea';
			const isCode = type.kind !== 'text';
			return (
				<FormTextField
					title={field.label}
					placeholder={isCode && !isMultiline ? '* * * * *' : 'Value'}
					text={value}
					onChangeText={setValue}
					autocapitalization="never"
					autocorrectionDisabled
					axis={isMultiline ? 'vertical' : 'horizontal'}
					lineLimit={isMultiline ? { min: 3, max: 10 } : undefined}
					monospaced={isCode}
					helper={field.description}
					layout={field.stacked ? 'stacked' : 'automatic'}
				/>
			);
		}
		case 'containerMultiSelect':
			return (
				<Button onPress={() => onOpenContainerSelect(field)} modifiers={[buttonStyle('plain')]}>
					<HStack modifiers={[contentShape(shapes.rectangle())]}>
						<LabeledContent label={field.label}>
							<Text>{excludedCountLabel(value)}</Text>
						</LabeledContent>
						<DisclosureChevron />
					</HStack>
				</Button>
			);
	}
}

function SettingsSection({
	section,
	draft,
	disabled,
	onOpenContainerSelect
}: {
	section: SettingsSectionDef;
	draft: EnvironmentSettingsDraft;
	disabled: boolean;
	onOpenContainerSelect: (field: SettingFieldDef) => void;
}) {
	const values = useDraft(draft, (s) => s.values);
	const visible = section.fields.filter((field) => isFieldVisible(field, values));
	if (visible.length === 0) return null;
	return (
		<Section title={section.title} modifiers={disabled ? [disabledModifier(true)] : []}>
			{visible.map((field) => (
				<SettingFieldRow
					key={field.key}
					field={field}
					draft={draft}
					onOpenContainerSelect={onOpenContainerSelect}
				/>
			))}
		</Section>
	);
}

export function SettingsSectionsView({
	sections,
	draft,
	draftToken,
	disabled = false
}: {
	sections: SettingsSectionDef[];
	draft: EnvironmentSettingsDraft;
	draftToken: string;
	disabled?: boolean;
}) {
	const openContainerSelect = useOpenContainerMultiSelect(
		draft.getState().environmentID,
		draftToken
	);
	return (
		<>
			{sections.map((section) => (
				<SettingsSection
					key={section.id}
					section={section}
					draft={draft}
					disabled={disabled}
					onOpenContainerSelect={openContainerSelect}
				/>
			))}
		</>
	);
}

export function SettingsErrorSection({ draft }: { draft: EnvironmentSettingsDraft }) {
	const error = useDraft(draft, (s) => s.errorMessage);
	if (!error) return null;
	return (
		<Section>
			<Label
				title={error}
				systemImage="exclamationmark.triangle"
				modifiers={[foregroundStyle(systemColors.red)]}
			/>
		</Section>
	);
}

export function SaveBarClearanceSection({
	afterFooterlessSection = false
}: {
	afterFooterlessSection?: boolean;
}) {
	return <SettingsSaveBarSpacer afterFooterlessSection={afterFooterlessSection} />;
}

export function SettingsCategoryView({
	category,
	environmentID,
	environmentName
}: {
	category: SettingsCategoryDef;
	environmentID?: string;
	environmentName?: string;
}) {
	const model = useSettingsCategory(category, environmentID, environmentName);
	const { draft } = model;
	return (
		<>
			<Stack.Screen options={{ title: category.title, headerLargeTitleEnabled: false }} />
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<Host style={{ flex: 1 }}>
					<Form modifiers={[refreshable(model.load)]}>
						<SettingsSectionsView
							sections={category.sections}
							draft={draft}
							draftToken={model.draftToken}
						/>
						<SettingsErrorSection draft={draft} />
						<SaveBarClearanceSection afterFooterlessSection />
					</Form>
				</Host>
				{model.isLoading && !model.hasLoaded ? (
					<View
						pointerEvents="none"
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<ArcaneLoadingView label="Loading…" />
					</View>
				) : null}
				<SettingsSaveBar
					hasChanges={model.hasChanges}
					isSaving={model.isSaving}
					isInteractionDisabled={model.isLoading}
					onSave={model.save}
					onRevert={model.revert}
				/>
			</View>
		</>
	);
}

export function ContainerMultiSelectView({
	title,
	selection,
	onSelectionChange,
	containers
}: {
	title: string;
	selection: string;
	onSelectionChange: (selection: string) => void;
	containers: string[];
}) {
	const accent = useAccentColor();
	const [search, setSearch] = useState('');
	const rows = containerSelectRows(containers, selection);
	const displayedRows = filterContainerSelectRows(rows, search);
	const selected = selectedContainerNames(selection);

	return (
		<>
			<Stack.Screen
				options={{
					title,
					headerLargeTitleEnabled: false,
					headerSearchBarOptions: {
						placeholder: 'Search containers',
						hideWhenScrolling: false,
						onChangeText: (event) => setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => setSearch('')
					}
				}}
			/>
			<Host style={{ flex: 1 }}>
				<List>
					{rows.length === 0 ? (
						<ContentUnavailableView
							title="No Containers"
							systemImage="shippingbox"
							description="Running containers will appear here to exclude from this job."
						/>
					) : (
						<Section
							footer={
								<Text>Selected containers are skipped by this job. Names are matched exactly.</Text>
							}
						>
							{displayedRows.map((row) => (
								<Button
									key={row.name}
									onPress={() => onSelectionChange(toggleContainerSelection(selection, row.name))}
									modifiers={[buttonStyle('plain')]}
								>
									<HStack spacing={12} modifiers={[contentShape(shapes.rectangle())]}>
										<VStack alignment="leading" spacing={2}>
											<Text modifiers={[foregroundStyle('primary')]}>{row.name}</Text>
											{!row.isRunning ? (
												<Text
													modifiers={[
														font({ textStyle: 'caption' }),
														foregroundStyle({ type: 'hierarchical', style: 'secondary' })
													]}
												>
													Not running
												</Text>
											) : null}
										</VStack>
										<Spacer minLength={12} />
										{selected.has(row.name) ? (
											<Image
												systemName="checkmark"
												modifiers={[font({ weight: 'semibold' }), foregroundStyle(accent)]}
											/>
										) : null}
									</HStack>
								</Button>
							))}
						</Section>
					)}
				</List>
			</Host>
		</>
	);
}

export function ContainerMultiSelectScreen() {
	const params = useLocalSearchParams<ContainerMultiSelectParams>();
	const draft = registeredSettingsDraft(params.draft);
	if (!draft) {
		return (
			<ContainerMultiSelectView
				title={params.title ?? 'Excluded Containers'}
				selection=""
				onSelectionChange={() => {}}
				containers={[]}
			/>
		);
	}
	return (
		<BoundContainerMultiSelect
			draft={draft}
			field={params.field ?? ''}
			title={params.title ?? 'Excluded Containers'}
		/>
	);
}

function BoundContainerMultiSelect({
	draft,
	field,
	title
}: {
	draft: EnvironmentSettingsDraft;
	field: string;
	title: string;
}) {
	const selection = useDraft(draft, (s) => s.values[field] ?? '');
	const containers = useDraft(draft, (s) => s.runningContainers);
	return (
		<ContainerMultiSelectView
			title={title}
			selection={selection}
			onSelectionChange={(next) => draft.getState().setValue(field, next)}
			containers={containers}
		/>
	);
}
