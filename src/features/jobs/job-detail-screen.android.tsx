import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { CenteredMessage, M3Section, ValueRow } from '@/features/containers/android-material';
import { formattedISO8601 } from '@/core/date-formatting';
import type { JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { CronExpression } from './cron-expression';
import { capitalized, jobIcon, jobTint } from './job-model';
import { useJobDetail } from './use-job-detail';

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

function JobDetailContent({ job, isRunning }: { job: JobStatus; isRunning: boolean }) {
	const readable = CronExpression.readable(job.schedule);
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			style={{ backgroundColor: colors.systemGroupedBackground }}
			contentContainerStyle={{ paddingBottom: 24 }}
		>
			<M3Section>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						gap: 16,
						paddingHorizontal: 16,
						paddingVertical: 14
					}}
				>
					<Icon name={jobIcon(job, isRunning)} size={24} color={jobTint(job, isRunning)} />
					<View style={{ flex: 1 }}>
						<Text style={[m3Type.titleMedium, { color: colors.label }]}>{job.name}</Text>
						{job.category !== '' ? (
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								{capitalized(job.category)}
							</Text>
						) : null}
					</View>
				</View>
				{job.description !== '' ? (
					<Text
						selectable
						style={[
							m3Type.bodyLarge,
							{ color: colors.label, paddingHorizontal: 16, paddingBottom: 14 }
						]}
					>
						{job.description}
					</Text>
				) : null}
			</M3Section>

			<M3Section title="Schedule">
				<ValueRow title="Cron" value={job.schedule} monospaced />
				{readable !== undefined ? (
					<ValueRow title="Runs" value={readable} selectable={false} />
				) : null}
				{job.nextRun ? (
					<ValueRow
						title="Next Run"
						value={formattedISO8601(job.nextRun, 'abbreviated', 'standard')}
						selectable={false}
					/>
				) : null}
			</M3Section>

			<M3Section title="Flags">
				<ValueRow title="Enabled" value={yesNo(job.enabled)} selectable={false} />
				<ValueRow title="Continuous" value={yesNo(job.isContinuous)} selectable={false} />
				<ValueRow title="Manager Only" value={yesNo(job.managerOnly)} selectable={false} />
				<ValueRow title="Runnable Manually" value={yesNo(job.canRunManually)} selectable={false} />
			</M3Section>

			{job.prerequisites.length > 0 ? (
				<M3Section title="Prerequisites">
					{job.prerequisites.map((prerequisite, index) => (
						<View
							key={index}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 16,
								paddingHorizontal: 16,
								paddingVertical: 10
							}}
						>
							<Icon
								name={prerequisite.isMet ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
								size={22}
								color={prerequisite.isMet ? systemColors.green : systemColors.red}
							/>
							<View style={{ flex: 1, gap: 2 }}>
								<Text style={[m3Type.bodyMedium, { color: colors.label }]}>
									{prerequisite.label}
								</Text>
								<Text
									style={[
										m3Type.bodySmall,
										{ color: colors.tertiaryLabel, fontFamily: monoFamily }
									]}
								>
									{prerequisite.settingKey}
								</Text>
							</View>
						</View>
					))}
				</M3Section>
			) : null}

			<M3Section title="Identifier">
				<ValueRow title="Job ID" value={job.id} monospaced />
				{job.settingsKey ? (
					<ValueRow title="Settings Key" value={job.settingsKey} monospaced />
				) : null}
			</M3Section>
		</ScrollView>
	);
}

export function JobDetailScreen() {
	const { item, errorMessage, isRunning, run } = useJobDetail();
	const job = item?.value;

	let content;
	if (job) {
		content = <JobDetailContent job={job} isRunning={isRunning} />;
	} else if (errorMessage !== undefined) {
		content = (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load Job"
				message={errorMessage}
			/>
		);
	} else {
		content = (
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.systemGroupedBackground
				}}
			>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: job?.name ?? '' }} />
			{job?.canRunManually ? (
				<AndroidToolbar
					items={[
						isRunning
							? { kind: 'spinner', id: 'run', label: 'Run Now' }
							: {
									kind: 'button',
									id: 'run',
									icon: 'play.fill',
									label: 'Run Now',
									disabled: !job.enabled,
									onPress: run
								}
					]}
				/>
			) : null}
			{content}
		</>
	);
}
