/**
 * Ports of `JobRow` and `JobBadge` (JobsListView.swift). SwiftUI-tree.
 */
import { HStack, Spacer, Text, VStack, ZStack, useNativeState } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, symbolEffect } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';

import type { JobStatus } from '@/sdk/models/jobSchedule/JobSchedule';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { RowIcon } from '@/ui/components/row-icon';

import { jobBadge, jobIcon, jobTint, relativeNamed } from './job-model';

const tertiary = { type: 'hierarchical', style: 'tertiary' } as const;

export function JobBadge({ text, tint }: { text: string; tint: string }) {
	return (
		<Text modifiers={[font({ textStyle: 'caption2', weight: 'bold' }), foregroundStyle(tint)]}>
			{text}
		</Text>
	);
}

export function JobRow({
	job,
	isRunning,
	environmentName,
	environmentColor
}: {
	job: JobStatus;
	isRunning: boolean;
	environmentName?: string;
	environmentColor?: string;
}) {
	const rotating = useNativeState(isRunning);
	useEffect(() => {
		rotating.value = isRunning;
	}, [rotating, isRunning]);
	const next = relativeNamed(job.nextRun);
	const badge = jobBadge(job);

	return (
		<HStack alignment="top" spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<ZStack
				modifiers={[
					symbolEffect({ effect: 'rotate' }, { options: { repeat: {} }, isActive: rotating })
				]}
			>
				<RowIcon systemImage={jobIcon(job, isRunning)} tint={jobTint(job, isRunning)} />
			</ZStack>

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
							font({ textStyle: 'caption', design: 'monospaced' }),
							foregroundStyle(tertiary)
						]}
					>
						{job.schedule}
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
