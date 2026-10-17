/** Access rules for `BackupSettingsView` (BackupSettingsView.swift). Shared by both platforms. */
import { useBackupNavigation } from './backup-routes';
import { useBackupSessionScope, useGlobalPermissions } from './backup-scope';

export function useBackupSettings() {
	const permissions = useGlobalPermissions();
	const nav = useBackupNavigation();
	useBackupSessionScope();
	const canManage = permissions.isGlobalAdmin && permissions.has('system-backups:manage');
	const canRecoveryKey = permissions.has('system-backups:recovery-key');
	return {
		canManage,
		canListS3: permissions.has('s3-destinations:list'),
		canRecoveryKey,
		showsRecovery: canManage || canRecoveryKey,
		openSystemPolicies: () => nav.openPolicies({ kind: 'system' }),
		openVolumePolicies: () => nav.openPolicies({ kind: 'systemVolumes' }),
		openS3: nav.openS3,
		openRecoveryKey: nav.openRecoveryKey,
		openDiscover: nav.openDiscover
	};
}
