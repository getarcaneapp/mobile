import { M3Section } from '../shared/android-material';
import { AndroidFormScreen, NavItem } from './backup-android';
import { useBackupSettings } from './use-backup-settings';

export function BackupSettingsScreen() {
	const model = useBackupSettings();
	return (
		<AndroidFormScreen title="Backup Settings">
			{model.canManage ? (
				<M3Section title="Schedules">
					<NavItem
						title="System Backup Policies"
						icon="calendar"
						onPress={model.openSystemPolicies}
					/>
					<NavItem
						title="Volume Backup Policies"
						icon="externaldrive"
						onPress={model.openVolumePolicies}
					/>
				</M3Section>
			) : null}
			{model.canListS3 ? (
				<M3Section title="Storage">
					<NavItem
						title="S3 Destinations"
						icon="externaldrive.connected.to.line.below"
						onPress={model.openS3}
					/>
				</M3Section>
			) : null}
			{model.showsRecovery ? (
				<M3Section title="Recovery">
					{model.canRecoveryKey ? (
						<NavItem title="Recovery Key" icon="key" onPress={model.openRecoveryKey} />
					) : null}
					{model.canManage ? (
						<NavItem
							title="Discover Backups in S3"
							icon="magnifyingglass"
							onPress={model.openDiscover}
						/>
					) : null}
				</M3Section>
			) : null}
		</AndroidFormScreen>
	);
}
