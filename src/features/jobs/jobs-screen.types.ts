import type { EnvironmentID } from '@/sdk/client/environment';

/** `JobsView(environmentID:allEnvironments:)`. */
export type JobsScreenProps = {
	environmentID: EnvironmentID;
	/** All Environments preview: list and act on resources from every enabled environment. */
	allEnvironments: boolean;
};
