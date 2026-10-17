/** Port of Models/Backup/SystemBackupPolicyCollection.swift. */
import type { SystemBackupPolicy } from './SystemBackupPolicy';

export interface SystemBackupPolicyCollection {
	policies: SystemBackupPolicy[];
	recoveryKeyStored: boolean;
}
