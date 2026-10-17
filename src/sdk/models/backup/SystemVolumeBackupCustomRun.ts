/** Port of Models/Backup/SystemVolumeBackupCustomRun.swift. */

export interface SystemVolumeBackupCustomRun {
	destination: string;
	s3DestinationId?: string;
	stopContainers: boolean;
	selectionMode: string;
	volumeNames: string[];
	ignoreAnonymous: boolean;
}
