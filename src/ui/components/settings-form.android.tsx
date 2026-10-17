import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import { ArcaneLoadingView } from './arcane-loading-view';
import { FormNumberField, FormPicker, FormSecureField, FormTextField } from './form-fields';
import { m3 } from './material-colors';
import {
	useDraft,
	isFieldVisible,
	registeredSettingsDraft,
	type EnvironmentSettingsDraft
} from './settings-form-draft';
import {
	useOpenContainerMultiSelect,
	type ContainerMultiSelectParams
} from './settings-form-navigation';
import {
	SettingsSaveBar,
	settingsSaveBarHeight as settingsSaveBarClearance
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
import { m3Type } from './type-scale';
import { useSettingsCategory } from './use-settings-category';
import { M3Switch } from '@/ui/material/switch';

function Divider() {
	return <View style={{ height: 1, marginLeft: 16, backgroundColor: colors.separator }} />;
}

export function SettingFieldRow({
	field,
	draft,
	onOpenContainerSelect
}: {
	field: SettingFieldDef;
	draft: EnvironmentSettingsDraft;
	onOpenContainerSelect: (field: SettingFieldDef) => void;
}) {
	const value = useDraft(draft, (s) => s.values[field.key] ?? '');
	const networkNames = useDraft(draft, (s) => s.networkNames);
	const setValue = (next: string) => draft.getState().setValue(field.key, next);
	const type = field.type;

	switch (type.kind) {
		case 'boolean': {
			const isOn = settingBool(value);
			return (
				<Pressable
					onPress={() => setValue(String(!isOn))}
					accessibilityRole="switch"
					accessibilityState={{ checked: isOn }}
					android_ripple={{ color: colors.separator as string }}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 16,
						minHeight: 56,
						paddingHorizontal: 16,
						paddingVertical: 8
					}}
				>
					<View style={{ flex: 1, gap: 2 }}>
						<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{field.label}</Text>
						{field.description ? (
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
								{field.description}
							</Text>
						) : null}
					</View>
					<M3Switch
						value={isOn}
						onValueChange={(next) => setValue(String(next))}
						accessibilityLabel={field.label}
					/>
				</Pressable>
			);
		}
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
				<Pressable
					onPress={() => onOpenContainerSelect(field)}
					accessibilityRole="button"
					android_ripple={{ color: colors.separator as string }}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 16,
						minHeight: 56,
						paddingHorizontal: 16
					}}
				>
					<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{field.label}</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
						{excludedCountLabel(value)}
					</Text>
					<Icon name="chevron.right" size={18} color={colors.secondaryLabel} />
				</Pressable>
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
		<View>
			<MaterialSectionHeader title={section.title} />
			<View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.5 : 1 }}>
				<MaterialListGroup>
					{visible.map((field, index) => (
						<Fragment key={field.key}>
							{index > 0 ? <Divider /> : null}
							<SettingFieldRow
								field={field}
								draft={draft}
								onOpenContainerSelect={onOpenContainerSelect}
							/>
						</Fragment>
					))}
				</MaterialListGroup>
			</View>
		</View>
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
		<View style={{ paddingTop: 16 }}>
			<MaterialListGroup>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
					<Icon name="exclamationmark.triangle" size={22} color={systemColors.red} />
					<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>{error}</Text>
				</View>
			</MaterialListGroup>
		</View>
	);
}

export function SaveBarClearanceSection() {
	return <View style={{ height: settingsSaveBarClearance }} />;
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
	const [refreshing, setRefreshing] = useState(false);
	const { draft } = model;
	return (
		<>
			<Stack.Screen options={{ title: category.title }} />
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				<ScrollView
					contentContainerStyle={{ paddingBottom: 16 }}
					keyboardShouldPersistTaps="handled"
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => {
								setRefreshing(true);
								void model.load().finally(() => setRefreshing(false));
							}}
						/>
					}
				>
					<SettingsSectionsView
						sections={category.sections}
						draft={draft}
						draftToken={model.draftToken}
					/>
					<SettingsErrorSection draft={draft} />
					<SaveBarClearanceSection />
				</ScrollView>
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
	const [search, setSearch] = useState('');
	const rows = containerSelectRows(containers, selection);
	const displayedRows = filterContainerSelectRows(rows, search);
	const selected = selectedContainerNames(selection);

	return (
		<>
			<Stack.Screen
				options={{
					title,
					headerSearchBarOptions: {
						placeholder: 'Search containers',
						onChangeText: (event) => setSearch(event.nativeEvent.text),
						onCancelButtonPress: () => setSearch('')
					}
				}}
			/>
			{rows.length === 0 ? (
				<View
					style={{
						flex: 1,
						alignItems: 'center',
						justifyContent: 'center',
						padding: 32,
						gap: 8,
						backgroundColor: colors.systemGroupedBackground
					}}
				>
					<Icon name="shippingbox" size={44} color={colors.secondaryLabel} />
					<Text style={[m3Type.titleLarge, { color: colors.label, textAlign: 'center' }]}>
						No Containers
					</Text>
					<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}>
						Running containers will appear here to exclude from this job.
					</Text>
				</View>
			) : (
				<ScrollView
					style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingVertical: 12 }}
				>
					<MaterialListGroup>
						{displayedRows.map((row, index) => {
							const isSelected = selected.has(row.name);
							return (
								<Fragment key={row.name}>
									{index > 0 ? <Divider /> : null}
									<Pressable
										onPress={() => onSelectionChange(toggleContainerSelection(selection, row.name))}
										accessibilityRole="checkbox"
										accessibilityState={{ checked: isSelected }}
										android_ripple={{ color: colors.separator as string }}
										style={{
											flexDirection: 'row',
											alignItems: 'center',
											gap: 12,
											minHeight: 56,
											paddingHorizontal: 16,
											paddingVertical: 8
										}}
									>
										<View style={{ flex: 1, gap: 2 }}>
											<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{row.name}</Text>
											{!row.isRunning ? (
												<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
													Not running
												</Text>
											) : null}
										</View>
										{isSelected ? <Icon name="checkmark" size={22} color={m3.primary} /> : null}
									</Pressable>
								</Fragment>
							);
						})}
					</MaterialListGroup>
					<Text
						style={[
							m3Type.bodySmall,
							{ color: colors.secondaryLabel, paddingHorizontal: 32, paddingTop: 6 }
						]}
					>
						Selected containers are skipped by this job. Names are matched exactly.
					</Text>
				</ScrollView>
			)}
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
