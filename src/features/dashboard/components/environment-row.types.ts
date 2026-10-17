import type { Environment } from '@/sdk/models/environment/EnvironmentModel';
import type { DockerInfo } from '@/sdk/models/system/DockerInfo';

export type EnvironmentRowProps = {
	environment: Environment;
	dockerInfo: DockerInfo | undefined;
	isActive: boolean;
	allEnvironmentsPreview: boolean;
	onOpen: () => void;
	onRefresh: () => Promise<void>;
	onUseEnvironment: () => void;
	onColor: () => void;
	onUpgrade: () => void;
	onPrune: () => void;
};
