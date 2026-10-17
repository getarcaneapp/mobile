/**
 * Port of `JobScheduleConfigView` (JobScheduleConfigView.swift): one cron
 * field per background job, saved to the environment's settings.
 */
import { Host } from '@/ui/host';
import { Button, Form, HStack, Label, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	font,
	foregroundStyle,
	frame,
	padding,
	refreshable,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { EnvironmentID } from '@/sdk/client/environment';
import { systemColors, withOpacity } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormTextField } from '@/ui/components/form-fields';
import { AppToolbar } from '@/ui/components/toolbar';

import { CronExpression } from './cron-expression';
import {
	jobScheduleFields,
	useJobScheduleConfig,
	type JobScheduleConfigModel,
	type JobScheduleField
} from './use-job-schedule-config';
import { scheduleFooter } from './job-schedule-copy';

function ScheduleRow({ model, field }: { model: JobScheduleConfigModel; field: JobScheduleField }) {
	const value = model.value(field.key);
	return (
		<VStack alignment="leading" spacing={8} modifiers={[padding({ vertical: 4 })]}>
			<HStack spacing={10}>
				<Image
					systemName={field.icon as SFSymbol}
					modifiers={[
						font({ textStyle: 'callout', weight: 'semibold' }),
						foregroundStyle(field.tint),
						frame({ width: 28, height: 28 }),
						background(withOpacity(field.tint, 0.15), shapes.circle())
					]}
				/>
				<Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>
					{field.label}
				</Text>
				<Spacer />
			</HStack>
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
		</VStack>
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

	return (
		<>
			<Stack.Screen options={{ title: 'Schedules', headerLargeTitleEnabled: false }} />
			<AppToolbar>
				<Stack.Toolbar.Button
					icon="arrow.clockwise"
					accessibilityLabel="Refresh"
					disabled={model.isLoading}
					onPress={() => void model.refresh()}
				/>
				{model.isSaving ? (
					<Stack.Toolbar.View>
						<ActivityIndicator accessibilityLabel="Saving" />
					</Stack.Toolbar.View>
				) : (
					// Swift: a plain `.confirmationAction` text item sharing the refresh button's glass group.
					// AppToolbarItem's explicit accent wins over disabled dimming, so Save stays accent
					// and just doesn't respond until there are changes.
					<Stack.Toolbar.Button onPress={() => (model.hasChanges ? model.save() : undefined)}>
						Save
					</Stack.Toolbar.Button>
				)}
			</AppToolbar>
			<Host style={{ flex: 1 }}>
				<Form modifiers={[refreshable(model.refresh)]}>
					{model.showsLoading ? (
						<Section>
							<HStack>
								<Spacer />
								<ArcaneLoadingViewSwiftUI label="Loading schedules…" />
								<Spacer />
							</HStack>
						</Section>
					) : (
						<>
							<Section footer={<Text>{scheduleFooter(environmentName)}</Text>}>
								{jobScheduleFields.map((field) => (
									<ScheduleRow key={field.key} model={model} field={field} />
								))}
							</Section>

							{model.hasChanges ? (
								<Section>
									<Button role="destructive" onPress={model.discardChanges}>
										<HStack>
											<Spacer />
											<Text>Discard Changes</Text>
											<Spacer />
										</HStack>
									</Button>
								</Section>
							) : null}

							{model.errorMessage !== undefined ? (
								<Section>
									<Label
										title={model.errorMessage}
										systemImage="exclamationmark.triangle"
										modifiers={[foregroundStyle(systemColors.red)]}
									/>
								</Section>
							) : null}
						</>
					)}
				</Form>
			</Host>
		</>
	);
}

/** Route screen: `job-schedules?envID=…&envName=…`. */
export function JobScheduleConfigScreen() {
	const { envID = '0', envName } = useLocalSearchParams<{ envID?: string; envName?: string }>();
	return <JobScheduleConfigView key={envID} environmentID={envID} environmentName={envName} />;
}
