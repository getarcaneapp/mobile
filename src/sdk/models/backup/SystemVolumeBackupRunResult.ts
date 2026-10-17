/** Port of Models/Backup/SystemVolumeBackupRunResult.swift. */
import type { SystemVolumeBackupFailure } from './SystemVolumeBackupFailure';

export interface SystemVolumeBackupRunResult {
	matched: number;
	succeeded: number;
	failed: number;
	skipped: number;
	failures: SystemVolumeBackupFailure[];
}
