import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { M3Section, ValueRow } from '@/features/containers/android-material';
import {
	AndroidResourceActionsToolbar,
	AndroidToolbar
} from '@/features/containers/android-toolbar';
import { LongPressMenu } from '@/features/containers/long-press-menu';
import { SectionTitle, SheetError } from '@/features/networks/android-parts';

import { CopyValueRow, SwarmListState } from './swarm-parts';
import {
	itemName,
	KeyValueKind,
	useSwarmKeyValueCreate,
	useSwarmKeyValueDetail,
	useSwarmKeyValues
} from './use-swarm-key-values';

export function SwarmKeyValuesScreen() {
	const model = useSwarmKeyValues();
	const [refreshing, setRefreshing] = useState(false);
	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					headerSearchBarOptions: {
						placeholder: `Search ${model.title.toLowerCase()}`,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			{model.canManage ? (
				<AndroidToolbar
					items={[
						{
							kind: 'button',
							id: 'create',
							icon: 'plus',
							label: `Create ${KeyValueKind.singular(model.kind)}`,
							onPress: model.openCreate
						}
					]}
				/>
			) : null}
			<SwarmListState
				isLoading={model.isLoading}
				isEmpty={model.items.length === 0}
				errorMessage={model.errorMessage}
				emptyTitle={`No ${model.title}`}
				emptySystemImage={KeyValueKind.systemImage(model.kind)}
				retry={() => void model.load()}
			>
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingBottom: 32 }}
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
					<SectionTitle title={model.headerText} />
					<MaterialListGroup>
						{model.displayedItems.map((item) => (
							<LongPressMenu
								key={item.id}
								title={itemName(item)}
								items={
									model.canManage
										? [
												{
													id: 'delete',
													title: 'Delete',
													destructive: true,
													onPress: () => model.requestDelete(item)
												}
											]
										: []
								}
								onPress={() => model.openDetail(item)}
								style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 3 }}
							>
								<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{itemName(item)}</Text>
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									{model.updatedText(item)}
								</Text>
							</LongPressMenu>
						))}
					</MaterialListGroup>
				</ScrollView>
			</SwarmListState>
		</>
	);
}

export function SwarmKeyValueDetailScreen() {
	const model = useSwarmKeyValueDetail();
	const { item } = model;
	if (!item) return <Stack.Screen options={{ title: '' }} />;
	return (
		<>
			<Stack.Screen options={{ title: model.name }} />
			{model.canManage ? (
				<AndroidResourceActionsToolbar
					overflow={model.toolbar.overflow}
					runningItemID={model.toolbar.runningItemID}
					isDisabled={model.toolbar.isDisabled}
					resourceName={model.name}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section title="Details">
					<ValueRow title="Name" value={model.name} />
					<CopyValueRow title="ID" value={item.id} />
					<ValueRow title="Created" value={model.createdText} />
					<ValueRow title="Updated" value={model.updatedText} />
				</M3Section>
				{model.kind === 'config' ? (
					<M3Section title="Data">
						{model.data !== undefined ? (
							<Text
								selectable
								style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label, padding: 16 }}
							>
								{model.data}
							</Text>
						) : (
							<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel, padding: 16 }]}>
								Binary or empty data.
							</Text>
						)}
					</M3Section>
				) : (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="lock.fill" size={18} color={colors.secondaryLabel} />
							<Text style={[m3Type.bodyLarge, { color: colors.secondaryLabel, flex: 1 }]}>
								Secret values can't be read back from Docker.
							</Text>
						</View>
					</M3Section>
				)}
			</ScrollView>
		</>
	);
}

export function SwarmKeyValueCreateScreen() {
	const model = useSwarmKeyValueCreate();
	return (
		<>
			<Stack.Screen options={{ title: model.title, gestureEnabled: !model.dismissDisabled }} />
			<AndroidToolbar
				placement="left"
				items={[
					{
						kind: 'button',
						id: 'cancel',
						icon: 'xmark',
						label: 'Cancel',
						disabled: model.isSaving,
						onPress: model.cancel
					}
				]}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'create',
						icon: 'checkmark',
						label: 'Create',
						disabled: !model.canCreate,
						onPress: model.create
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section>
					<FormTextField
						title="Name"
						placeholder={model.namePlaceholder}
						text={model.name}
						onChangeText={model.setName}
						autocapitalization="never"
						autocorrectionDisabled
					/>
				</M3Section>
				<M3Section title={model.kind === 'config' ? 'Data' : 'Secret'} footer={model.footer}>
					{model.kind === 'secret' ? (
						<FormSecureField
							title="Value"
							placeholder="Required"
							text={model.data}
							onChangeText={model.setData}
						/>
					) : (
						<TextInput
							value={model.data}
							onChangeText={model.setData}
							multiline
							autoCapitalize="none"
							autoCorrect={false}
							accessibilityLabel="Data"
							style={{
								minHeight: 220,
								margin: 16,
								padding: 12,
								borderWidth: 1,
								borderColor: m3.outline,
								borderRadius: 4,
								fontFamily: monoFamily,
								fontSize: 13,
								color: colors.label,
								textAlignVertical: 'top'
							}}
						/>
					)}
				</M3Section>
				<SheetError message={model.errorMessage} />
			</ScrollView>
		</>
	);
}
