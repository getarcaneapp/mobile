import {
	EnvironmentUpdateResult,
	type EnvironmentUpdateResultStatus
} from '@/sdk/models/system/Upgrade';

export type EnvironmentUpdateSceneKind =
	| 'loading'
	| 'ready'
	| 'starting'
	| 'updating'
	| 'restarting'
	| 'reconnecting'
	| 'completed'
	| 'warning'
	| 'failed';

export type EnvironmentUpdateTint = 'accent' | 'orange' | 'green' | 'red' | 'gray';

export const EnvironmentUpdateSceneKind = {
	tint(kind: EnvironmentUpdateSceneKind): EnvironmentUpdateTint {
		switch (kind) {
			case 'reconnecting':
			case 'warning':
				return 'orange';
			case 'completed':
				return 'green';
			case 'failed':
				return 'red';
			default:
				return 'accent';
		}
	},

	symbol(kind: EnvironmentUpdateSceneKind): string {
		switch (kind) {
			case 'loading':
				return 'ellipsis';
			case 'ready':
				return 'arrow.up.circle.fill';
			case 'starting':
			case 'updating':
				return 'arrow.triangle.2.circlepath';
			case 'restarting':
				return 'antenna.radiowaves.left.and.right';
			case 'reconnecting':
				return 'wifi';
			case 'completed':
				return 'checkmark';
			case 'warning':
				return 'exclamationmark';
			case 'failed':
				return 'xmark';
		}
	},

	isTerminal(kind: EnvironmentUpdateSceneKind): boolean {
		return kind === 'completed' || kind === 'warning' || kind === 'failed';
	}
} as const;

export interface EnvironmentUpdateRingEnvironment {
	result: EnvironmentUpdateResult;
	slotIndex: number;
	totalCount: number;
}

export const EnvironmentUpdateRingEnvironment = {
	id(value: EnvironmentUpdateRingEnvironment): string {
		return EnvironmentUpdateResult.id(value.result);
	}
} as const;

export interface EnvironmentUpdateSceneModel {
	kind: EnvironmentUpdateSceneKind;
	title: string;
	subtitle: string;
	progress?: number;
	completedCount: number;
	totalCount: number;
	activeEnvironment?: EnvironmentUpdateResult;
	ringEnvironments: EnvironmentUpdateRingEnvironment[];
}

export function makeEnvironmentUpdateSceneModel(args: {
	kind: EnvironmentUpdateSceneKind;
	title: string;
	subtitle: string;
	progress?: number;
	completedCount?: number;
	totalCount?: number;
	activeEnvironment?: EnvironmentUpdateResult;
	ringEnvironments?: EnvironmentUpdateRingEnvironment[];
}): EnvironmentUpdateSceneModel {
	return {
		kind: args.kind,
		title: args.title,
		subtitle: args.subtitle,
		progress: args.progress,
		completedCount: args.completedCount ?? 0,
		totalCount: args.totalCount ?? 0,
		activeEnvironment: args.activeEnvironment,
		ringEnvironments: args.ringEnvironments ?? []
	};
}

export const EnvironmentUpdateSceneModelHelpers = {
	showsPercentage(m: EnvironmentUpdateSceneModel): boolean {
		return (
			m.kind === 'updating' && m.activeEnvironment == null && m.progress != null && m.totalCount > 0
		);
	},

	showsActiveEnvironment(m: EnvironmentUpdateSceneModel): boolean {
		return m.activeEnvironment != null;
	},

	ringFraction(m: EnvironmentUpdateSceneModel): number {
		if (!EnvironmentUpdateSceneKind.isTerminal(m.kind) && m.totalCount > 0 && m.progress != null) {
			return Math.min(Math.max(m.progress, 0), 1);
		}
		switch (m.kind) {
			case 'ready':
				return 0;
			case 'loading':
			case 'starting':
			case 'updating':
				return 0.14;
			default:
				return 1;
		}
	},

	percentage(m: EnvironmentUpdateSceneModel): number {
		return Math.round(EnvironmentUpdateSceneModelHelpers.ringFraction(m) * 100);
	},

	accessibilityValue(m: EnvironmentUpdateSceneModel): string {
		const progressDescription =
			m.totalCount > 0
				? `${m.completedCount} of ${m.totalCount} environments complete`
				: m.subtitle;
		const active = m.activeEnvironment;
		if (!active) return progressDescription;
		if (m.kind === 'reconnecting') {
			return `${active.environmentName} updating. ${progressDescription}. ${m.subtitle}`;
		}
		return `${active.environmentName} updating. ${progressDescription}`;
	}
} as const;

export type EnvironmentUpdateBubblePresentation =
	| 'pending'
	| 'updating'
	| 'succeeded'
	| 'skipped'
	| 'failed'
	| 'unknown';

export const EnvironmentUpdateBubblePresentation = {
	fromStatus(status: EnvironmentUpdateResultStatus): EnvironmentUpdateBubblePresentation {
		switch (status) {
			case 'pending':
				return 'pending';
			case 'updating':
				return 'updating';
			case 'updated':
			case 'up_to_date':
			case 'triggered':
				return 'succeeded';
			case 'skipped_offline':
				return 'skipped';
			case 'failed':
				return 'failed';
			case 'unknown':
				return 'unknown';
		}
	},

	terminalSymbol(p: EnvironmentUpdateBubblePresentation): string | undefined {
		switch (p) {
			case 'pending':
			case 'updating':
				return undefined;
			case 'succeeded':
				return 'checkmark';
			case 'skipped':
				return 'wifi.slash';
			case 'failed':
				return 'xmark';
			case 'unknown':
				return 'questionmark';
		}
	},

	isTerminal(p: EnvironmentUpdateBubblePresentation): boolean {
		return EnvironmentUpdateBubblePresentation.terminalSymbol(p) != null;
	}
} as const;

export type EnvironmentUpdateBubbleTint = EnvironmentUpdateTint;

export function pipelineBubbleSize(count: number): number {
	if (count <= 5) return 40;
	if (count <= 8) return 32;
	if (count <= 12) return 26;
	return 20;
}

export function pipelineConnectorFill(
	environment: EnvironmentUpdateRingEnvironment,
	activeEnvironmentID: string | undefined
): number {
	const p = EnvironmentUpdateBubblePresentation.fromStatus(environment.result.status);
	if (EnvironmentUpdateBubblePresentation.isTerminal(p)) return 1;
	if (EnvironmentUpdateRingEnvironment.id(environment) === activeEnvironmentID) return 0.5;
	return 0;
}

export function bubbleTint(
	presentation: EnvironmentUpdateBubblePresentation,
	tint: EnvironmentUpdateTint
): EnvironmentUpdateTint {
	switch (presentation) {
		case 'pending':
		case 'updating':
			return tint;
		case 'succeeded':
			return 'green';
		case 'skipped':
			return 'gray';
		case 'failed':
			return 'red';
		case 'unknown':
			return 'orange';
	}
}

export const EnvironmentUpdateBubblePhases = [
	{ x: 0, y: 0, scale: 1 },
	{ x: 2.8, y: -2.2, scale: 1.006 },
	{ x: 2.1, y: 2.5, scale: 1.003 },
	{ x: -2.7, y: 1.8, scale: 0.996 },
	{ x: -2.2, y: -2.6, scale: 0.999 }
] as const;
