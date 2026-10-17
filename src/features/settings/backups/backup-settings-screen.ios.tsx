import { Section } from '@expo/ui/swift-ui';

import { BackupFormChrome } from './backup-form-chrome';
import { NavigationLabelRow } from './backup-rows';
import { useBackupSettings } from './use-backup-settings';

export function BackupSettingsScreen() {
	const model = useBackupSettings();
	return (
		<BackupFormChrome title="Backup Settings" presentation="push">
			{model.canManage ? (
				<Section title="Schedules">
					<NavigationLabelRow
						title="System Backup Policies"
						systemImage="calendar"
						onPress={model.openSystemPolicies}
					/>
					<NavigationLabelRow
						title="Volume Backup Policies"
						systemImage="externaldrive"
						onPress={model.openVolumePolicies}
					/>
				</Section>
			) : null}
			{model.canListS3 ? (
				<Section title="Storage">
					<NavigationLabelRow
						title="S3 Destinations"
						systemImage="externaldrive.connected.to.line.below"
						onPress={model.openS3}
					/>
				</Section>
			) : null}
			{model.showsRecovery ? (
				<Section title="Recovery">
					{model.canRecoveryKey ? (
						<NavigationLabelRow
							title="Recovery Key"
							systemImage="key"
							onPress={model.openRecoveryKey}
						/>
					) : null}
					{model.canManage ? (
						<NavigationLabelRow
							title="Discover Backups in S3"
							systemImage="magnifyingglass"
							onPress={model.openDiscover}
						/>
					) : null}
				</Section>
			) : null}
		</BackupFormChrome>
	);
}
