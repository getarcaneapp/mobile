import type { ReactNode } from 'react';

import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';

import type { AllEnvironmentsCounts } from '../dashboard-logic';
import type { OverviewAttentionAction } from '../dashboard-overview-logic';

export type AllEnvironmentsDashboardProps = {
	environments: Environment[];
	dockerInfo: Readonly<Record<string, DockerInfo>>;
	counts: AllEnvironmentsCounts;
	volumeCounts: Readonly<Record<string, number>>;
	isAdmin: boolean;
	canPrune: boolean;
	onOpenEnvironment: (environment: Environment) => void;
	onOpenContainer: (container: ContainerSummary, environmentID: string) => void;
	onOpenUpdates: () => void;
	onOpenSecurity: () => void;
	onAttention: (action: OverviewAttentionAction) => void;
	onOpenActivity: (status?: 'failed') => void;
	onOpenJobs: (environmentID: string) => void;
	onPrune: () => void;
	onEditLayout: () => void;
	totalsFootnote: ReactNode;
	hostsAccessory: ReactNode;
};
