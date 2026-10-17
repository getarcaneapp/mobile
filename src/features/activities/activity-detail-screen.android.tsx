import { Stack } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import { formattedClockTime, formattedISO8601 } from '@/core/date-formatting';
import type { ActivityMessage } from '@/sdk/models/activity/Activity';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { ErrorBanner } from '@/ui/components/error-banner';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup, MaterialSectionHeader } from '@/ui/material/list';

import {
	ActivityDisplay,
	capitalizedWords,
	formatDuration,
	messageLevelIcon,
	messageLevelTint,
	startedByLabel
} from './activity-display';
import type { ActivityDetailScreenProps } from './activity-detail-screen.types';
import {
	ActivityIcon,
	ActivityProgressView,
	ActivityToolbar,
	materialTint
} from './activity-material';
import { useActivityDetail } from './use-activities';

function Divider() {
	return <View style={{ height: 1, marginLeft: 16, backgroundColor: colors.separator }} />;
}

function Group({ title, children }: { title?: string; children: ReactNode[] }) {
	const rows = children.filter((child) => child !== null && child !== undefined && child !== false);
	return (
		<View>
			{title ? <MaterialSectionHeader title={title} /> : <View style={{ height: 12 }} />}
			<MaterialListGroup>
				{rows.map((row, index) => (
					<View key={index}>
						{index > 0 ? <Divider /> : null}
						{row}
					</View>
				))}
			</MaterialListGroup>
		</View>
	);
}

function ValueRow({ title, value }: { title: string; value: string }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 48,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{title}</Text>
			<Text
				selectable
				style={[m3Type.bodyMedium, { flex: 1, textAlign: 'right', color: colors.secondaryLabel }]}
			>
				{value}
			</Text>
		</View>
	);
}

function ActivityMessageRow({ message }: { message: ActivityMessage }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'flex-start',
				gap: 10,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			<View
				importantForAccessibility="no-hide-descendants"
				style={{ width: 20, alignItems: 'center', paddingTop: 1 }}
			>
				<Icon
					name={messageLevelIcon(message.level)}
					size={18}
					color={materialTint(messageLevelTint(message.level))}
				/>
			</View>
			<View style={{ flex: 1, gap: 3 }}>
				<Text selectable style={[m3Type.bodyMedium, { color: colors.label }]}>
					{message.message}
				</Text>
				<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
					{formattedClockTime(message.createdAt) ?? message.createdAt}
				</Text>
			</View>
		</View>
	);
}

export function ActivityDetailScreen({
	activity: initialActivity,
	sharedStore
}: ActivityDetailScreenProps) {
	const model = useActivityDetail(initialActivity, sharedStore);
	const { activity, messages } = model;
	const [refreshing, setRefreshing] = useState(false);
	const error = activity.error;
	const source = activity.sourceEnvironmentName;
	const resourceID = activity.resourceID;

	const { errorMessage } = model;
	const dismissError = useRef(model.dismissError);
	dismissError.current = model.dismissError;
	useEffect(() => {
		if (errorMessage === undefined) return;
		const dismiss = () => dismissError.current();
		Alert.alert('Error', errorMessage, [{ text: 'OK', onPress: dismiss }], { onDismiss: dismiss });
	}, [errorMessage]);

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
			<Stack.Screen options={{ title: 'Activity' }} />
			<ActivityToolbar
				items={
					model.canCancel
						? [
								model.isCancelling
									? { kind: 'spinner', id: 'cancel', label: 'Cancel activity' }
									: {
											kind: 'button',
											id: 'cancel',
											icon: 'xmark.circle',
											label: 'Cancel activity',
											color: systemColors.red,
											onPress: model.requestCancel
										}
							]
						: []
				}
			/>
			<View style={{ flex: 1 }}>
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={{ backgroundColor: colors.systemGroupedBackground }}
					contentContainerStyle={{ paddingBottom: 24 }}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={() => void onRefresh()}
							colors={[systemColors.blue]}
						/>
					}
				>
					{model.streamErrorMessage !== undefined ? (
						<View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
							<ErrorBanner
								message={model.streamErrorMessage}
								severity="warning"
								retry={model.retryStream}
							/>
						</View>
					) : null}
					<Group>
						{[
							<View
								key="header"
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									gap: 14,
									paddingHorizontal: 16,
									paddingVertical: 14
								}}
							>
								<ActivityIcon activity={activity} />
								<View style={{ flex: 1, gap: 4 }}>
									<Text style={[m3Type.titleMedium, { color: colors.label }]}>
										{ActivityDisplay.displayTitle(activity)}
									</Text>
									<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
										{ActivityDisplay.subtitle(activity)}
									</Text>
								</View>
								<ResourceStatusBadge status={activity.status} />
							</View>,
							ActivityDisplay.displayProgress(activity) !== undefined ||
							ActivityDisplay.isCancellable(activity) ? (
								<View key="progress" style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
									<ActivityProgressView
										progress={ActivityDisplay.displayProgress(activity)}
										isActive={ActivityDisplay.isCancellable(activity)}
										tint={ActivityDisplay.statusTint(activity)}
										showsPercentage
									/>
								</View>
							) : null,
							error !== undefined && error !== '' ? (
								<Text
									key="error"
									selectable
									style={[
										m3Type.bodyMedium,
										{ color: systemColors.red, paddingHorizontal: 16, paddingVertical: 12 }
									]}
								>
									{error}
								</Text>
							) : null
						]}
					</Group>
					<Group title="Details">
						{[
							<ValueRow
								key="type"
								title="Type"
								value={ActivityDisplay.typeDisplayName(activity)}
							/>,
							<ValueRow key="status" title="Status" value={capitalizedWords(activity.status)} />,
							<ValueRow
								key="started"
								title="Started"
								value={formattedISO8601(activity.startedAt, 'abbreviated', 'standard')}
							/>,
							activity.endedAt !== undefined ? (
								<ValueRow
									key="ended"
									title="Ended"
									value={formattedISO8601(activity.endedAt, 'abbreviated', 'standard')}
								/>
							) : null,
							activity.durationMs !== undefined ? (
								<ValueRow
									key="duration"
									title="Duration"
									value={formatDuration(activity.durationMs)}
								/>
							) : null,
							activity.startedBy !== undefined ? (
								<ValueRow key="by" title="Started By" value={startedByLabel(activity.startedBy)} />
							) : null,
							source !== undefined && source !== '' ? (
								<ValueRow key="source" title="Source" value={source} />
							) : null,
							resourceID !== undefined && resourceID !== '' ? (
								<ValueRow key="resource" title="Resource ID" value={resourceID} />
							) : null
						]}
					</Group>
					{messages.length > 0 ? (
						<Group title="Messages">
							{messages.map((message) => (
								<ActivityMessageRow key={message.id} message={message} />
							))}
						</Group>
					) : null}
				</ScrollView>
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
