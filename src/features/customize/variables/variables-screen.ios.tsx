import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import {
	Button,
	ContentUnavailableView,
	ContextMenu,
	DisclosureGroup,
	Divider,
	HStack,
	Label,
	List,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityHint,
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	frame,
	labelStyle,
	listStyle,
	refreshable,
	shapes,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { ActivityIndicator } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { parseArcaneDate } from '@/sdk/models/base/date';
import type { EnvironmentSyncStatus, GlobalVariable } from '@/sdk/models/variable/Variable';
import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';

import { maskedSecret, relativeDuration } from './variable-format';
import { syncStateDisplayName, syncStatusPresentation } from './variables-store';
import { useVariables, type VariablesModel } from './use-variables';

const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

function VariableRow({ variable, scopeLabel }: { variable: GlobalVariable; scopeLabel: string }) {
	return (
		<VStack
			alignment="leading"
			spacing={6}
			modifiers={[contentShape(shapes.rectangle()), accessibilityElement('combine')]}
		>
			<HStack spacing={8}>
				<Text
					modifiers={[
						font({ textStyle: 'body', design: 'monospaced' }),
						foregroundStyle({ type: 'hierarchical', style: 'primary' })
					]}
				>
					{variable.key}
				</Text>
				{variable.isSecret ? (
					<Label
						title="Secret"
						systemImage="lock.fill"
						modifiers={[
							font({ textStyle: 'caption2', weight: 'semibold' }),
							foregroundStyle(systemColors.orange),
							labelStyle('titleAndIcon')
						]}
					/>
				) : null}
				<Spacer />
			</HStack>
			<Text
				modifiers={[
					font({ textStyle: 'subheadline', design: 'monospaced' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' })
				]}
			>
				{variable.isSecret ? maskedSecret : variable.value}
			</Text>
			<Label
				title={scopeLabel}
				systemImage={variable.allEnvironments ? 'globe' : 'server.rack'}
				modifiers={[font({ textStyle: 'caption' }), tertiary]}
			/>
		</VStack>
	);
}

function VariableSyncStatusRow({ status }: { status: EnvironmentSyncStatus }) {
	const { icon, color } = syncStatusPresentation(status.status);
	const tintStyle = foregroundStyle(color ?? 'secondary');
	const lastSyncedAt = parseArcaneDate(status.lastSyncedAt);
	return (
		<HStack alignment="top" spacing={10} modifiers={[accessibilityElement('combine')]}>
			<Image systemName={icon as SFSymbol} modifiers={[tintStyle, accessibilityHidden(true)]} />
			<VStack alignment="leading" spacing={2}>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' })]}>
					{status.environmentName || status.environmentID}
				</Text>
				{status.error ? (
					<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.red)]}>
						{status.error}
					</Text>
				) : lastSyncedAt ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>{`Synced ${relativeDuration(lastSyncedAt)} ago`}</Text>
				) : null}
			</VStack>
			<Spacer />
			<Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), tintStyle]}>
				{syncStateDisplayName(status.status)}
			</Text>
		</HStack>
	);
}

function VariableMenuItems({
	model,
	variable
}: {
	model: VariablesModel;
	variable: GlobalVariable;
}) {
	return (
		<>
			{model.canUpdate ? (
				<Button
					label="Edit Variable"
					systemImage="pencil"
					onPress={() => model.openEditor(variable)}
				/>
			) : null}
			<Button label="Copy Key" systemImage="doc.on.doc" onPress={() => model.copyKey(variable)} />
			{!variable.isSecret ? (
				<Button
					label="Copy Value"
					systemImage="doc.on.doc.fill"
					onPress={() => model.copyValue(variable)}
				/>
			) : null}
			{model.canDelete ? (
				<>
					<Divider />
					<Button
						role="destructive"
						onPress={() => model.requestDelete(variable)}
						modifiers={[tint(systemColors.red)]}
					>
						<DestructiveLabel text="Delete Variable" />
					</Button>
				</>
			) : null}
		</>
	);
}

function VariableListRow({ model, variable }: { model: VariablesModel; variable: GlobalVariable }) {
	const row = <VariableRow variable={variable} scopeLabel={model.scopeLabel(variable)} />;
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>
					{model.canUpdate ? (
						<Button
							onPress={() => model.openEditor(variable)}
							modifiers={[buttonStyle('plain'), accessibilityHint('Opens variable editor')]}
						>
							{row}
						</Button>
					) : (
						row
					)}
				</ContextMenu.Trigger>
				<ContextMenu.Items>
					<VariableMenuItems model={model} variable={variable} />
				</ContextMenu.Items>
			</ContextMenu>
			<SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
				<Button
					label="Copy Key"
					systemImage="doc.on.doc"
					onPress={() => model.copyKey(variable)}
					modifiers={[tint(systemColors.blue)]}
				/>
			</SwipeActions.Actions>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				{model.canDelete ? (
					<Button
						role="destructive"
						label="Delete"
						systemImage="trash"
						onPress={() => model.requestDelete(variable)}
					/>
				) : null}
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

function VariableList({ model }: { model: VariablesModel }) {
	const { snapshot, summary } = model;
	return (
		<List modifiers={[listStyle('insetGrouped'), refreshable(model.load)]}>
			{snapshot.syncStatuses.length > 0 ? (
				<Section>
					<DisclosureGroup
						isExpanded={model.showsSyncStatus}
						onIsExpandedChange={model.setShowsSyncStatus}
					>
						<DisclosureGroup.Label>
							<Label
								title={summary.text}
								systemImage={summary.icon as SFSymbol}
								modifiers={[foregroundStyle(summary.color ?? 'secondary')]}
							/>
						</DisclosureGroup.Label>
						{snapshot.syncStatuses.map((status) => (
							<VariableSyncStatusRow key={status.environmentID} status={status} />
						))}
					</DisclosureGroup>
				</Section>
			) : null}
			<Section
				header={
					<ResourceCountSectionHeader
						title="Variables"
						loadedCount={model.displayedVariables.length}
					/>
				}
			>
				{model.displayedVariables.length === 0 ? (
					<ContentUnavailableView
						title={`No Results for “${model.searchText}”`}
						systemImage="magnifyingglass"
						description="Check the spelling or try a new search."
					/>
				) : (
					model.displayedVariables.map((variable) => (
						<VariableListRow key={variable.id} model={model} variable={variable} />
					))
				)}
			</Section>
		</List>
	);
}

function VariablesToolbar({ model }: { model: VariablesModel }) {
	const accent = useAccentColor();
	if (!model.showsToolbar) return null;
	return (
		<AppToolbar placement="right" tintColor={accent}>
			{model.canSync ? (
				model.snapshot.isSyncing ? (
					<Stack.Toolbar.View>
						<ActivityIndicator accessibilityLabel="Sync variables" />
					</Stack.Toolbar.View>
				) : (
					<Stack.Toolbar.Button
						icon="arrow.triangle.2.circlepath"
						accessibilityLabel="Sync variables"
						onPress={() => void model.syncVariables()}
					/>
				)
			) : null}
			{model.canCreate ? (
				<Stack.Toolbar.Button
					icon="plus"
					separateBackground
					accessibilityLabel="Create variable"
					onPress={() => model.openEditor()}
				/>
			) : null}
		</AppToolbar>
	);
}

export function VariablesScreen() {
	const model = useVariables();
	const { snapshot } = model;
	const fill = frame({ maxWidth: Infinity, maxHeight: Infinity });

	let content;
	if (!model.canRead) {
		content = (
			<ContentUnavailableView
				title="Variables Access Required"
				systemImage="lock.fill"
				description="Your role cannot view global variables."
			/>
		);
	} else if (snapshot.isLoading && snapshot.variables.length === 0) {
		content = (
			<VStack modifiers={[fill]}>
				<ArcaneLoadingViewSwiftUI label="Loading variables…" />
			</VStack>
		);
	} else if (snapshot.isUnsupported) {
		content = (
			<ContentUnavailableView
				title="Variables Unavailable"
				systemImage="curlybraces"
				description="Update Arcane to manage scoped variables from the mobile app."
			/>
		);
	} else if (snapshot.errorMessage !== undefined && snapshot.variables.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Variables"
				systemImage="exclamationmark.triangle"
				description={snapshot.errorMessage}
				actions={[{ title: 'Try Again', onPress: () => void model.load() }]}
			/>
		);
	} else if (snapshot.variables.length === 0) {
		content = (
			<UnavailableView
				title="No Variables"
				systemImage="curlybraces"
				description="Create a variable and choose which environments receive it."
				actions={
					model.canCreate ? [{ title: 'Create Variable', onPress: () => model.openEditor() }] : []
				}
			/>
		);
	} else {
		content = <VariableList model={model} />;
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Variables',
					headerSearchBarOptions: {
						placeholder: 'Search variables',
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			<VariablesToolbar model={model} />
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
