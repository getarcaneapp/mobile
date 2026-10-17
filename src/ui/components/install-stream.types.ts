import { systemColors } from '@/theme/colors';

export type InstallStreamLine = { id: string; text: string; isError?: boolean };

export type InstallStreamStatus =
	| { kind: 'running' }
	| { kind: 'success' }
	| { kind: 'failure'; message: string };

export const isTerminal = (status: InstallStreamStatus) => status.kind !== 'running';

export type DeploymentOperation = {
	id: string;
	title: string;
	systemImage: string;
	status: InstallStreamStatus;
	progressFraction?: number;
	currentPhase?: string;
	lines: InstallStreamLine[];
	isServerSynced?: boolean;
};

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

export function servicePrefixEnd(text: string): number | undefined {
	if (!text.startsWith('[')) return undefined;
	const close = text.indexOf(']');
	if (close <= 0) return undefined;
	const distance = close + 1;
	return distance <= 64 ? distance : undefined;
}

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
	onDone: () => void;
	onHide: () => void;
};

export type DeploymentPillProps = {
	operation: DeploymentOperation;
	onTap: () => void;
	onDismiss: () => void;
};
