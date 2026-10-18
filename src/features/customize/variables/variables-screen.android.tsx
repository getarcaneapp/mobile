import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { withCleanup } from '@/core/with-cleanup';
import {
	AndroidToolbar,
	type AndroidToolbarItem
} from '@/features/settings/shared/android-toolbar';
import { CenteredMessage } from '@/features/settings/shared/android-material';
import { LongPressMenu, type RowMenuItem } from '@/features/settings/shared/long-press-menu';
import { parseArcaneDate } from '@/sdk/models/base/date';
import type { EnvironmentSyncStatus, GlobalVariable } from '@/sdk/models/variable/Variable';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ResourceCountSectionHeader } from '@/ui/components/labels';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { maskedSecret, relativeDuration } from './variable-format';
import { syncStateDisplayName, syncStatusPresentation } from './variables-store';
import { useVariables, type VariablesModel } from './use-variables';

function VariableRow({ variable, scopeLabel }: { variable: GlobalVariable; scopeLabel: string }) {
	return (
		<View style={{ gap: 6, flex: 1 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label, fontFamily: monoFamily }]}>
					{variable.key}
				</Text>
				{variable.isSecret ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
						<Icon name="lock.fill" size={11} color={systemColors.orange} />
						<Text style={[m3Type.labelSmall, { color: systemColors.orange }]}>Secret</Text>
					</View>
				) : null}
			</View>
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, fontFamily: monoFamily }]}>
				{variable.isSecret ? maskedSecret : variable.value}
			</Text>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
				<Icon
					name={variable.allEnvironments ? 'globe' : 'server.rack'}
					size={12}
					color={colors.tertiaryLabel}
				/>
				<Text style={[m3Type.bodySmall, { color: colors.tertiaryLabel }]}>{scopeLabel}</Text>
			</View>
		</View>
	);
}

function VariableSyncStatusRow({ status }: { status: EnvironmentSyncStatus }) {
	const { icon, color } = syncStatusPresentation(status.status);
	const tint = color ?? colors.secondaryLabel;
	const lastSyncedAt = parseArcaneDate(status.lastSyncedAt);
	return (
		<View
			accessible
			style={{
				flexDirection: 'row',
				alignItems: 'flex-start',
				gap: 10,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<Icon name={icon} size={18} color={tint} />
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.titleSmall, { color: colors.label }]}>
					{status.environmentName || status.environmentID}
				</Text>
				{status.error ? (
					<Text style={[m3Type.bodySmall, { color: systemColors.red }]}>{status.error}</Text>
				) : lastSyncedAt ? (
					<Text
						style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
					>{`Synced ${relativeDuration(lastSyncedAt)} ago`}</Text>
				) : null}
			</View>
			<Text style={[m3Type.labelMedium, { color: tint }]}>
				{syncStateDisplayName(status.status)}
			</Text>
		</View>
	);
}

function rowMenu(model: VariablesModel, variable: GlobalVariable): RowMenuItem[] {
	const items: RowMenuItem[] = [];
	if (model.canUpdate)
		items.push({ id: 'edit', title: 'Edit Variable', onPress: () => model.openEditor(variable) });
	items.push({ id: 'copy-key', title: 'Copy Key', onPress: () => model.copyKey(variable) });
	if (!variable.isSecret)
		items.push({ id: 'copy-value', title: 'Copy Value', onPress: () => model.copyValue(variable) });
	if (model.canDelete)
		items.push({
			id: 'delete',
			title: 'Delete Variable',
			destructive: true,
			onPress: () => model.requestDelete(variable)
		});
	return items;
}

function SyncStatusSection({ model }: { model: VariablesModel }) {
	const { summary } = model;
	const tint = summary.color ?? colors.secondaryLabel;
	return (
		<View style={{ paddingTop: 12 }}>
			<MaterialListGroup>
				<Pressable
					onPress={() => model.setShowsSyncStatus(!model.showsSyncStatus)}
					accessibilityRole="button"
					accessibilityState={{ expanded: model.showsSyncStatus }}
					android_ripple={{ color: colors.separator as string }}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 12,
						minHeight: 48,
						paddingHorizontal: 16
					}}
				>
					<Icon name={summary.icon} size={20} color={tint} />
					<Text style={[m3Type.bodyLarge, { color: tint, flex: 1 }]}>{summary.text}</Text>
					<Icon
						name={model.showsSyncStatus ? 'chevron.up' : 'chevron.down'}
						size={18}
						color={colors.secondaryLabel}
					/>
				</Pressable>
				{model.showsSyncStatus
					? model.snapshot.syncStatuses.map((status) => (
							<VariableSyncStatusRow key={status.environmentID} status={status} />
						))
					: null}
			</MaterialListGroup>
		</View>
	);
}

export function VariablesScreen() {
	const model = useVariables();
	const { snapshot } = model;
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		await withCleanup(
			() => model.load(),
			() => setRefreshing(false)
		);
	};

	let content;
	if (!model.canRead) {
		content = (
			<CenteredMessage
				icon="lock.fill"
				title="Variables Access Required"
				message="Your role cannot view global variables."
			/>
		);
	} else if (snapshot.isLoading && snapshot.variables.length === 0) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading variables…" />
			</View>
		);
	} else if (snapshot.isUnsupported) {
		content = (
			<CenteredMessage
				icon="curlybraces"
				title="Variables Unavailable"
				message="Update Arcane to manage scoped variables from the mobile app."
			/>
		);
	} else if (snapshot.errorMessage !== undefined && snapshot.variables.length === 0) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Variables"
				message={snapshot.errorMessage}
				action={{ title: 'Try Again', onPress: () => void model.load() }}
			/>
		);
	} else if (snapshot.variables.length === 0) {
		content = (
			<CenteredMessage
				icon="curlybraces"
				title="No Variables"
				message="Create a variable and choose which environments receive it."
				action={
					model.canCreate
						? { title: 'Create Variable', onPress: () => model.openEditor() }
						: undefined
				}
			/>
		);
	} else {
		content = (
			<>
				{snapshot.syncStatuses.length > 0 ? <SyncStatusSection model={model} /> : null}
				<ResourceCountSectionHeader
					title="Variables"
					loadedCount={model.displayedVariables.length}
				/>
				<MaterialListGroup>
					{model.displayedVariables.length === 0 ? (
						<View style={{ padding: 24, alignItems: 'center', gap: 6 }}>
							<Icon name="magnifyingglass" size={32} color={colors.secondaryLabel} />
							<Text
								style={[m3Type.titleMedium, { color: colors.label, textAlign: 'center' }]}
							>{`No Results for “${model.searchText}”`}</Text>
							<Text
								style={[m3Type.bodyMedium, { color: colors.secondaryLabel, textAlign: 'center' }]}
							>
								Check the spelling or try a new search.
							</Text>
						</View>
					) : (
						model.displayedVariables.map((variable) => (
							<LongPressMenu
								key={variable.id}
								items={rowMenu(model, variable)}
								title={variable.key}
								onPress={model.canUpdate ? () => model.openEditor(variable) : undefined}
								style={{ paddingHorizontal: 16, paddingVertical: 12 }}
							>
								<VariableRow variable={variable} scopeLabel={model.scopeLabel(variable)} />
							</LongPressMenu>
						))
					)}
				</MaterialListGroup>
			</>
		);
	}

	const toolbar: AndroidToolbarItem[] = [];
	if (model.showsToolbar && model.canSync) {
		toolbar.push(
			snapshot.isSyncing
				? { kind: 'spinner', id: 'sync', label: 'Sync variables' }
				: {
						kind: 'button',
						id: 'sync',
						icon: 'arrow.triangle.2.circlepath',
						label: 'Sync variables',
						onPress: () => void model.syncVariables()
					}
		);
	}
	if (model.showsToolbar && model.canCreate) {
		toolbar.push({
			kind: 'button',
			id: 'create',
			icon: 'plus',
			label: 'Create variable',
			onPress: () => model.openEditor()
		});
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: 'Variables',
					headerSearchBarOptions: {
						placeholder: 'Search variables',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{toolbar.length > 0 ? <AndroidToolbar items={toolbar} /> : null}
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={() => void onRefresh()}
						colors={[systemColors.blue]}
					/>
				}
			>
				{content}
			</ScrollView>
		</>
	);
}
