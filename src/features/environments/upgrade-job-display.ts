import {
	EnvironmentUpdateStage,
	type EnvironmentUpdateResult,
	type EnvironmentUpdateResultStatus
} from '@/sdk/models/system/Upgrade';

import { managerEnvironmentID } from './upgrade-job-follow';

export type UpgradeResultTint = 'accent' | 'green' | 'orange' | 'red' | 'gray';

const statusLabels: Record<EnvironmentUpdateResultStatus, string> = {
	pending: 'Pending',
	updating: 'Updating',
	updated: 'Updated',
	up_to_date: 'Up to Date',
	triggered: 'Triggered',
	skipped_offline: 'Skipped Offline',
	failed: 'Failed',
	unknown: 'Unknown'
};

export function upgradeResultLabel(result: EnvironmentUpdateResult): string {
	if (result.status !== 'updating' || !result.stage) return statusLabels[result.status];
	if (result.stage === 'reconnecting' && result.environmentId === managerEnvironmentID)
		return 'Manager restarting';
	return EnvironmentUpdateStage.label(result.stage);
}

export function upgradeResultTint(result: EnvironmentUpdateResult): UpgradeResultTint {
	switch (result.status) {
		case 'updating':
			return 'accent';
		case 'updated':
		case 'up_to_date':
			return 'green';
		case 'triggered':
		case 'skipped_offline':
		case 'unknown':
			return 'orange';
		case 'failed':
			return 'red';
		case 'pending':
			return 'gray';
	}
}

export function upgradeResultSymbol(result: EnvironmentUpdateResult): string {
	switch (result.status) {
		case 'updated':
		case 'up_to_date':
			return 'checkmark.circle.fill';
		case 'updating':
			return 'arrow.triangle.2.circlepath';
		case 'triggered':
		case 'skipped_offline':
		case 'unknown':
			return 'exclamationmark.circle.fill';
		case 'failed':
			return 'xmark.octagon.fill';
		case 'pending':
			return 'clock.fill';
	}
}

export function upgradeResultDetail(result: EnvironmentUpdateResult): string | undefined {
	if (result.status === 'failed' && result.error) return result.error;
	const from = result.fromVersion?.trim() ?? '';
	const to = result.toVersion?.trim() ?? '';
	if (!from || !to || from === to) return to || from || undefined;
	return `${from} → ${to}`;
}

export function upgradeResultIsManager(result: EnvironmentUpdateResult): boolean {
	return result.environmentId === managerEnvironmentID;
}
