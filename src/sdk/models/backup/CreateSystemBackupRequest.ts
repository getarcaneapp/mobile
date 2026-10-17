export interface CreateSystemBackupRequest {
	destination?: string;
	s3DestinationId?: string;
	recoveryKey?: string;
	policyId?: string;
}
