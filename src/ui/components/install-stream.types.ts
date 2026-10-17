/**
 * Shared models + copy for `DeploymentPill` and `InstallStreamSheet`
 * (DeploymentPill.swift, InstallStreamSheet.swift). Minimal local shapes of
 * the Swift `DeploymentOperation` (owned by `DeploymentActivityStore`).
 */
import { systemColors } from '@/theme/colors';

/** Port of `InstallStreamLine`. */
export type InstallStreamLine = { id: string; text: string; isError?: boolean };

/** Port of `InstallStreamStatus`. */
export type InstallStreamStatus =
	| { kind: 'running' }
	| { kind: 'success' }
	| { kind: 'failure'; message: string };

export const isTerminal = (status: InstallStreamStatus) => status.kind !== 'running';

export type DeploymentOperation = {
	id: string;
	title: string;
	/** `operation.kind.systemImage`. */
	systemImage: string;
	status: InstallStreamStatus;
	/** 0...1 for pulls; undefined when indeterminate. */
	progressFraction?: number;
	currentPhase?: string;
	lines: InstallStreamLine[];
	/** Following a server-side activity rather than a local stream. */
	isServerSynced?: boolean;
};

/** The pill's secondary line. */
export function pillCaption(operation: DeploymentOperation) {
	switch (operation.status.kind) {
		case 'running': {
			const phase = operation.currentPhase ?? 'Working';
			return operation.progressFraction !== undefined
				? `${phase} · ${Math.trunc(operation.progressFraction * 100)}%`
				: `${phase}…`;
		}
		case 'success':
			return 'Complete';
		case 'failure':
			return 'Failed — tap for details';
	}
}

export function pillAccessibilityText(operation: DeploymentOperation) {
	const parts = [operation.title, pillCaption(operation)];
	if (operation.status.kind === 'running' && operation.progressFraction === undefined)
		parts.push('in progress');
	return parts.join(', ');
}

/** Console header phase label. */
export function phaseLabel(operation: DeploymentOperation) {
	switch (operation.status.kind) {
		case 'running':
			return operation.currentPhase ?? 'running';
		case 'success':
			return 'complete';
		case 'failure':
			return 'failed';
	}
}

/** `undefined` means the app accent. */
export function phaseTint(status: InstallStreamStatus): string | undefined {
	return status.kind === 'success'
		? systemColors.green
		: status.kind === 'failure'
			? systemColors.red
			: undefined;
}

export function doneLabel(status: InstallStreamStatus) {
	return status.kind === 'running' ? 'Running…' : status.kind === 'success' ? 'Done' : 'Close';
}

/** Length of a leading "[service]" prefix (≤ 64 chars) to color with the accent. */
export function servicePrefixEnd(text: string): number | undefined {
	if (!text.startsWith('[')) return undefined;
	const close = text.indexOf(']');
	if (close <= 0) return undefined;
	const distance = close + 1;
	return distance <= 64 ? distance : undefined;
}

/** Committed console palette (same in light and dark mode). */
export const consolePalette = {
	background: '#0D0D11',
	text: '#FFFFFFDE',
	dim: '#FFFFFF6B',
	rule: '#FFFFFF1A',
	buttonFill: '#FFFFFF14'
} as const;

export type InstallStreamSheetProps = {
	operation: DeploymentOperation;
	onCancel: () => void;
	/** Acknowledge a finished operation (`store.acknowledge()`); the sheet then hides. */
	onDone: () => void;
	/** Hide the sheet (`dismiss()`); the operation keeps running. */
	onHide: () => void;
};

export type DeploymentPillProps = {
	operation: DeploymentOperation;
	/** Reopen the full-log sheet. */
	onTap: () => void;
	/** Flick away a finished pill. */
	onDismiss: () => void;
};
