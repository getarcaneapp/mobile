import type { EnvironmentUpdateResult } from '@/sdk/models/system/Upgrade';

import type { UpdateCandidate } from './upgrade-job-follow';

export type UpgradeLogsProps = {
	logs: readonly string[] | undefined;
	maxHeight?: number;
};

export type UpgradeJobResultListProps = {
	results: readonly EnvironmentUpdateResult[];
	expandsLogs?: boolean;
};

export type UpdateTargetPickerProps = {
	candidates: readonly UpdateCandidate[];
	selected: readonly string[];
	onToggle: (id: string) => void;
	onSelectAll: () => void;
	onSelectNone: () => void;
};
