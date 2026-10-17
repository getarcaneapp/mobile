/** Port of Models/Backup/UploadSystemBackupRequest.swift. */

export interface UploadSystemBackupRequest {
	s3DestinationId: string;
	recoveryKey: string;
}
