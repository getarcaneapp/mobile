/**
 * Port of `ActivityDetailView` + `ActivityMessageRow`
 * (Views/Activities/ActivitiesView.swift): header, progress, details,
 * message log, live updates and Cancel Activity.
 */
import { Host } from '@/ui/host';
import {
	Alert,
	Button,
	HStack,
	LabeledContent,
	List,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { AlertAnchor } from '@/ui/components/alert-anchor';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	font,
	foregroundStyle,
	frame,
	listStyle,
	padding,
	refreshable,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { AppToolbar } from '@/ui/app-toolbar';
import { ActivityIndicator, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { formattedClockTime, formattedISO8601 } from '@/core/date-formatting';
import type { ActivityMessage } from '@/sdk/models/activity/Activity';
import { useAccentColor } from '@/theme/accent';
import { appAccentNavigationBar } from '../../../modules/arcane-swiftui-extras';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ErrorBanner } from '@/ui/components/error-banner';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';

import {
	ActivityDisplay,
	capitalizedWords,
	formatDuration,
	messageLevelIcon,
	messageLevelTint,
	startedByLabel
} from './activity-display';
import type { ActivityDetailScreenProps } from './activity-detail-screen.types';
import { ActivityIcon, ActivityProgressView, swiftTint } from './activity-swiftui';
import { useActivityDetail } from './use-activities';

function ActivityMessageRow({ message }: { message: ActivityMessage }) {
	return (
		<HStack alignment="top" spacing={10} modifiers={[padding({ vertical: 2 })]}>
			<Image
				systemName={messageLevelIcon(message.level) as SFSymbol}
				modifiers={[
					foregroundStyle(swiftTint(messageLevelTint(message.level))),
					frame({ width: 20 }),
					accessibilityHidden(true)
				]}
			/>
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'subheadline' }), textSelection(true)]}>
					{message.message}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{formattedClockTime(message.createdAt) ?? message.createdAt}
				</Text>
			</VStack>
		</HStack>
	);
}

function Value({ label, value }: { label: string; value: string }) {
	return (
		<LabeledContent label={label}>
			<Text>{value}</Text>
		</LabeledContent>
	);
}

export function ActivityDetailScreen({
	activity: initialActivity,
	sharedStore
}: ActivityDetailScreenProps) {
	const model = useActivityDetail(initialActivity, sharedStore);
	const accent = useAccentColor();
	const { activity, messages } = model;
	const error = activity.error;
	const source = activity.sourceEnvironmentName;
	const resourceID = activity.resourceID;

	return (
		<>
			<Stack.Screen options={{ title: 'Activity', headerLargeTitleEnabled: false }} />
			{model.canCancel ? (
				<AppToolbar placement="right" tintColor={accent}>
					{model.isCancelling ? (
						<Stack.Toolbar.View>
							<ActivityIndicator accessibilityLabel="Cancel activity" />
						</Stack.Toolbar.View>
					) : (
						<Stack.Toolbar.Button
							icon="xmark.circle"
							tintColor={systemColors.red}
							accessibilityLabel="Cancel activity"
							onPress={model.requestCancel}
						/>
					)}
				</AppToolbar>
			) : null}
			<View style={{ flex: 1 }}>
				<Host style={{ flex: 1 }}>
					<List
						modifiers={[
							listStyle('insetGrouped'),
							refreshable(model.refresh),
							appAccentNavigationBar(accent)
						]}
					>
						{model.streamErrorMessage !== undefined ? (
							<Section>
								<ErrorBanner
									message={model.streamErrorMessage}
									severity="warning"
									retry={model.retryStream}
								/>
							</Section>
						) : null}
						<Section>
							<HStack spacing={14} modifiers={[padding({ vertical: 4 })]}>
								<ActivityIcon activity={activity} />
								<VStack alignment="leading" spacing={4}>
									<Text modifiers={[font({ textStyle: 'headline' })]}>
										{ActivityDisplay.displayTitle(activity)}
									</Text>
									<Text
										modifiers={[
											font({ textStyle: 'subheadline' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{ActivityDisplay.subtitle(activity)}
									</Text>
								</VStack>
								<Spacer minLength={0} />
								<ResourceStatusBadge status={activity.status} />
							</HStack>
							<ActivityProgressView
								progress={ActivityDisplay.displayProgress(activity)}
								isActive={ActivityDisplay.isCancellable(activity)}
								tint={ActivityDisplay.statusTint(activity)}
								showsPercentage
							/>
							{error !== undefined && error !== '' ? (
								<Text
									modifiers={[
										font({ textStyle: 'subheadline' }),
										foregroundStyle(systemColors.red),
										textSelection(true)
									]}
								>
									{error}
								</Text>
							) : null}
						</Section>

						<Section title="Details">
							<Value label="Type" value={ActivityDisplay.typeDisplayName(activity)} />
							<Value label="Status" value={capitalizedWords(activity.status)} />
							<Value
								label="Started"
								value={formattedISO8601(activity.startedAt, 'abbreviated', 'standard')}
							/>
							{activity.endedAt !== undefined ? (
								<Value
									label="Ended"
									value={formattedISO8601(activity.endedAt, 'abbreviated', 'standard')}
								/>
							) : null}
							{activity.durationMs !== undefined ? (
								<Value label="Duration" value={formatDuration(activity.durationMs)} />
							) : null}
							{activity.startedBy !== undefined ? (
								<Value label="Started By" value={startedByLabel(activity.startedBy)} />
							) : null}
							{source !== undefined && source !== '' ? (
								<Value label="Source" value={source} />
							) : null}
							{resourceID !== undefined && resourceID !== '' ? (
								<Value label="Resource ID" value={resourceID} />
							) : null}
						</Section>

						{messages.length > 0 ? (
							<Section title="Messages">
								{messages.map((message) => (
									<ActivityMessageRow key={message.id} message={message} />
								))}
							</Section>
						) : null}
					</List>
					<Alert
						title="Error"
						isPresented={model.errorMessage !== undefined}
						onIsPresentedChange={(presented) => {
							if (!presented) model.dismissError();
						}}
					>
						<AlertAnchor />
						<Alert.Actions>
							<Button label="OK" onPress={model.dismissError} />
						</Alert.Actions>
						<Alert.Message>
							<Text>{model.errorMessage ?? ''}</Text>
						</Alert.Message>
					</Alert>
				</Host>
				{model.isLoading && messages.length === 0 ? (
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
						<ArcaneLoadingView />
					</View>
				) : null}
			</View>
		</>
	);
}
