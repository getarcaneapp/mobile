/** Port of Models/Backup/RestoreSystemBackupFilesRequest.swift. */

export interface RestoreSystemBackupFilesRequest {
	paths?: string[];
	selectAll?: boolean;
	search?: string;
	recoveryKey: string;
}
