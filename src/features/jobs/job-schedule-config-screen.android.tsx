/**
 * Android rendering of `JobScheduleConfigView` (JobScheduleConfigView.swift):
 * one cron field per background job in a Material 3 grouped list, with
 * refresh and save top-app-bar actions.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { M3Section, TextButtonRow } from '@/features/containers/android-material';
import type { EnvironmentID } from '@/sdk/client/environment';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormTextField } from '@/ui/components/form-fields';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { CronExpression } from './cron-expression';
import { scheduleFooter } from './job-schedule-copy';
import {
	jobScheduleFields,
	useJobScheduleConfig,
	type JobScheduleConfigModel,
	type JobScheduleField
} from './use-job-schedule-config';

function ScheduleRow({ model, field }: { model: JobScheduleConfigModel; field: JobScheduleField }) {
	const value = model.value(field.key);
	return (
		<View style={{ paddingTop: 12, paddingBottom: 4 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
				<View
					style={{
						width: 28,
						height: 28,
						borderRadius: 14,
						backgroundColor: withOpacity(field.tint, 0.15),
						alignItems: 'center',
						justifyContent: 'center'
					}}
				>
					<Icon name={field.icon} size={16} color={field.tint} />
				</View>
				<Text style={[m3Type.titleSmall, { color: colors.label }]}>{field.label}</Text>
			</View>
			<FormTextField
				title="Cron Expression"
				placeholder="* * * * *"
				text={value}
				onChangeText={(text) => model.setValue(field.key, text)}
				autocapitalization="never"
				autocorrectionDisabled
				monospaced
				helper={CronExpression.readable(value)}
			/>
		</View>
	);
}

export function JobScheduleConfigView({
	environmentID,
	environmentName
}: {
	environmentID: EnvironmentID;
	environmentName?: string;
}) {
	const model = useJobScheduleConfig(environmentID);
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await model.refresh();
		} finally {
			setRefreshing(false);
		}
	};

	return (
		<>
			<Stack.Screen options={{ title: 'Schedules' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'refresh',
						icon: 'arrow.clockwise',
						label: 'Refresh',
						disabled: model.isLoading,
						onPress: () => void model.refresh()
					},
					model.isSaving
						? { kind: 'spinner', id: 'save', label: 'Saving' }
						: {
								kind: 'button',
								id: 'save',
								icon: 'checkmark',
								label: 'Save',
								disabled: !model.hasChanges,
								onPress: model.save
							}
				]}
			/>
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
				{model.showsLoading ? (
					<M3Section>
						<View style={{ alignItems: 'center', paddingVertical: 16 }}>
							<ArcaneLoadingView label="Loading schedules…" />
						</View>
					</M3Section>
				) : (
					<>
						<M3Section footer={scheduleFooter(environmentName)}>
							{jobScheduleFields.map((field) => (
								<ScheduleRow key={field.key} model={model} field={field} />
							))}
						</M3Section>

						{model.hasChanges ? (
							<M3Section>
								<View style={{ alignItems: 'center' }}>
									<TextButtonRow
										title="Discard Changes"
										destructive
										onPress={model.discardChanges}
									/>
								</View>
							</M3Section>
						) : null}

						{model.errorMessage !== undefined ? (
							<M3Section>
								<View
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 12,
										paddingHorizontal: 16,
										paddingVertical: 14
									}}
								>
									<Icon name="exclamationmark.triangle" size={20} color={m3.error} />
									<Text style={[m3Type.bodyMedium, { flex: 1, color: m3.error }]}>
										{model.errorMessage}
									</Text>
								</View>
							</M3Section>
						) : null}
					</>
				)}
			</ScrollView>
		</>
	);
}

/** Route screen: `job-schedules?envID=…&envName=…`. */
export function JobScheduleConfigScreen() {
	const { envID = '0', envName } = useLocalSearchParams<{ envID?: string; envName?: string }>();
	return <JobScheduleConfigView key={envID} environmentID={envID} environmentName={envName} />;
}
