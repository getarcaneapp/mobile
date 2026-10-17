import { Host } from '@/ui/host';
import {
	ContentUnavailableView,
	HStack,
	Label,
	LabeledContent,
	List,
	Section,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	font,
	foregroundStyle,
	frame,
	listStyle,
	multilineTextAlignment,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { formattedISO8601 } from '@/core/date-formatting';
import type { JobPrerequisite, JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { AppToolbar } from '@/ui/components/toolbar';

import { CronExpression } from './cron-expression';
import { capitalized, jobIcon, jobTint } from './job-model';
import { useJobDetail } from './use-job-detail';

const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;
const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

function Row({ label, children }: { label: string; children: ReactNode }) {
	return <LabeledContent label={label}>{children}</LabeledContent>;
}

function ValueText({ value }: { value: string }) {
	return (
		<Text modifiers={[font({ textStyle: 'subheadline' }), multilineTextAlignment('trailing')]}>
			{value}
		</Text>
	);
}

function MonoText({ value, textStyle }: { value: string; textStyle: 'subheadline' | 'caption' }) {
	return (
		<Text
			modifiers={[
				font({ textStyle, design: 'monospaced' }),
				textSelection(true),
				multilineTextAlignment('trailing')
			]}
		>
			{value}
		</Text>
	);
}

function PrerequisitesSection({ prerequisites }: { prerequisites: JobPrerequisite[] }) {
	return (
		<Section title="Prerequisites">
			{prerequisites.map((prerequisite, index) => (
				<HStack key={index} spacing={10}>
					<Image
						systemName={prerequisite.isMet ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
						modifiers={[
							foregroundStyle(prerequisite.isMet ? systemColors.green : systemColors.red)
						]}
					/>
					<VStack alignment="leading" spacing={2}>
						<Text modifiers={[font({ textStyle: 'subheadline' })]}>{prerequisite.label}</Text>
						<Text
							modifiers={[
								font({ textStyle: 'caption', design: 'monospaced' }),
								foregroundStyle(tertiary)
							]}
						>
							{prerequisite.settingKey}
						</Text>
					</VStack>
				</HStack>
			))}
		</Section>
	);
}

function JobDetailList({ job, isRunning }: { job: JobStatus; isRunning: boolean }) {
	const readable = CronExpression.readable(job.schedule);
	return (
		<List modifiers={[listStyle('insetGrouped')]}>
			<Section>
				<Label
					icon={
						<Image
							systemName={jobIcon(job, isRunning) as SFSymbol}
							modifiers={[foregroundStyle(jobTint(job, isRunning))]}
						/>
					}
				>
					<VStack alignment="leading">
						<Text modifiers={[font({ textStyle: 'headline' })]}>{job.name}</Text>
						{job.category !== '' ? (
							<Text
								modifiers={[
									font({ textStyle: 'subheadline' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' })
								]}
							>
								{capitalized(job.category)}
							</Text>
						) : null}
					</VStack>
				</Label>
				{job.description !== '' ? (
					<Text modifiers={[textSelection(true)]}>{job.description}</Text>
				) : null}
			</Section>

			<Section title="Schedule">
				<Row label="Cron">
					<MonoText value={job.schedule} textStyle="subheadline" />
				</Row>
				{readable !== undefined ? (
					<Row label="Runs">
						<ValueText value={readable} />
					</Row>
				) : null}
				{job.nextRun ? (
					<Row label="Next Run">
						<ValueText value={formattedISO8601(job.nextRun, 'abbreviated', 'standard')} />
					</Row>
				) : null}
			</Section>

			<Section title="Flags">
				<Row label="Enabled">
					<ValueText value={yesNo(job.enabled)} />
				</Row>
				<Row label="Continuous">
					<ValueText value={yesNo(job.isContinuous)} />
				</Row>
				<Row label="Manager Only">
					<ValueText value={yesNo(job.managerOnly)} />
				</Row>
				<Row label="Runnable Manually">
					<ValueText value={yesNo(job.canRunManually)} />
				</Row>
			</Section>

			{job.prerequisites.length > 0 ? (
				<PrerequisitesSection prerequisites={job.prerequisites} />
			) : null}

			<Section title="Identifier">
				<Row label="Job ID">
					<MonoText value={job.id} textStyle="caption" />
				</Row>
				{job.settingsKey ? (
					<Row label="Settings Key">
						<MonoText value={job.settingsKey} textStyle="caption" />
					</Row>
				) : null}
			</Section>
		</List>
	);
}

export function JobDetailScreen() {
	const { item, errorMessage, isRunning, run } = useJobDetail();
	const job = item?.value;

	let content;
	if (job) {
		content = <JobDetailList job={job} isRunning={isRunning} />;
	} else if (errorMessage !== undefined) {
		content = (
			<ContentUnavailableView
				title="Couldn't Load Job"
				systemImage="exclamationmark.triangle"
				description={errorMessage}
			/>
		);
	} else {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading…" />
			</VStack>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: job?.name ?? '', headerLargeTitleEnabled: false }} />
			{job?.canRunManually ? (
				<AppToolbar>
					{isRunning ? (
						<Stack.Toolbar.View>
							<ActivityIndicator accessibilityLabel="Run Now" />
						</Stack.Toolbar.View>
					) : (
						<Stack.Toolbar.Button
							icon="play.fill"
							accessibilityLabel="Run Now"
							disabled={!job.enabled}
							onPress={run}
						/>
					)}
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
