import { HStack, Spacer, Text, VStack, ZStack, useNativeState } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, symbolEffect } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';

import type { JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { RowIcon } from '@/ui/components/row-icon';

import { CronExpression } from './cron-expression';
import { jobBadge, jobIcon, jobTint, relativeNamed } from './job-model';

const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;

export function JobBadge({ text, tint }: { text: string; tint: string }) {
	return (
		<Text modifiers={[font({ textStyle: 'caption2', weight: 'bold' }), foregroundStyle(tint)]}>
			{text}
		</Text>
	);
}

function RotatingJobIcon({ job, isRunning }: { job: JobStatus; isRunning: boolean }) {
	const rotating = useNativeState(isRunning);
	useEffect(() => {
		rotating.set(isRunning);
	}, [rotating, isRunning]);
	return (
		<ZStack
			modifiers={[
				symbolEffect({ effect: 'rotate' }, { options: { repeat: {} }, isActive: rotating })
			]}
		>
			<RowIcon systemImage={jobIcon(job, isRunning)} tint={jobTint(job, isRunning)} />
		</ZStack>
	);
}

export function JobRow({
	job,
	isRunning,
	environmentName,
	environmentColor,
	identity
}: {
	job: JobStatus;
	isRunning: boolean;
	environmentName?: string;
	environmentColor?: string;
	identity?: string;
}) {
	const next = relativeNamed(job.nextRun);
	const readableSchedule = CronExpression.readable(job.schedule);
	const badge = jobBadge(job);

	return (
		<HStack alignment="top" spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RotatingJobIcon key={identity} job={job} isRunning={isRunning} />

			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'body' })]}>{job.name}</Text>
				{job.description !== '' ? (
					<Text
						modifiers={[
							font({ textStyle: 'subheadline' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{job.description}
					</Text>
				) : null}
				<HStack spacing={6}>
					<Text
						modifiers={[
							font(
								readableSchedule !== undefined
									? { textStyle: 'caption' }
									: { textStyle: 'caption', design: 'monospaced' }
							),
							foregroundStyle(tertiary)
						]}
					>
						{readableSchedule ?? job.schedule}
					</Text>
					{next !== undefined ? (
						<>
							<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(tertiary)]}>•</Text>
							<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(tertiary)]}>
								{next}
							</Text>
						</>
					) : null}
				</HStack>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
			</VStack>
			<Spacer minLength={0} />
			{badge ? <JobBadge text={badge.text} tint={badge.tint} /> : null}
		</HStack>
	);
}
