export interface RestoreSystemBackupFilesRequest {
	paths?: string[];
	selectAll?: boolean;
	search?: string;
	recoveryKey: string;
}
