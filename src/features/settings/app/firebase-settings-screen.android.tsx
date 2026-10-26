import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';

import { M3Section, M3TextField, TextButtonRow, ValueRow } from '../shared/android-material';
import { FirebaseSettingsCopy, useFirebaseSettings } from './use-firebase-settings';

export function FirebaseSettingsScreen() {
	const model = useFirebaseSettings();
	return (
		<>
			<Stack.Screen options={{ title: 'Firebase' }} />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 24 }}
			>
				<M3Section footer={FirebaseSettingsCopy.importFooter}>
					<ValueRow title="Package" value={model.packageName} monospaced />
					<TextButtonRow
						title="Import from Clipboard"
						onPress={model.importFromClipboard}
						disabled={model.busy}
					/>
				</M3Section>
				<M3Section title="Project" footer={FirebaseSettingsCopy.valuesFooter}>
					<M3TextField
						label="Project ID"
						value={model.settings.projectId}
						onChangeText={(text) => model.setField('projectId', text)}
					/>
					<M3TextField
						label="App ID"
						value={model.settings.applicationId}
						onChangeText={(text) => model.setField('applicationId', text)}
						monospaced
					/>
					<M3TextField
						label="API Key"
						value={model.settings.apiKey}
						onChangeText={(text) => model.setField('apiKey', text)}
						monospaced
					/>
					<M3TextField
						label="Sender ID"
						value={model.settings.senderId}
						onChangeText={(text) => model.setField('senderId', text)}
						keyboardType="number-pad"
						monospaced
					/>
				</M3Section>
				<M3Section>
					<TextButtonRow title="Save" onPress={model.save} disabled={model.busy} />
					{model.firebaseReady ? (
						<TextButtonRow title="Remove" onPress={model.clear} disabled={model.busy} destructive />
					) : null}
				</M3Section>
			</ScrollView>
		</>
	);
}
