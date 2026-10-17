import type { SystemVolumeBackupCustomRun } from './SystemVolumeBackupCustomRun';

export interface RunSystemVolumeBackupsRequest {
	policyId?: string;
	custom?: SystemVolumeBackupCustomRun;
}
