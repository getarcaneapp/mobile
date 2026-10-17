import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { colors } from '@/theme/colors';

import { M3Section, ValueRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import {
	accessRows,
	trustRuleRows,
	useFederatedCredentialDetail
} from './use-federated-credential-detail';

export function FederatedCredentialDetailScreen() {
	const { credential, canEdit, edit } = useFederatedCredentialDetail();
	if (!credential) return null;
	return (
		<>
			<Stack.Screen options={{ title: credential.name }} />
			{canEdit ? (
				<AndroidToolbar
					items={[{ kind: 'button', id: 'edit', icon: 'pencil', label: 'Edit', onPress: edit }]}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
			>
				<M3Section title="Trust rule">
					{trustRuleRows(credential).map((row) => (
						<ValueRow key={row.label} title={row.label} value={row.value} />
					))}
				</M3Section>
				<M3Section title="Access">
					{accessRows(credential).map((row) => (
						<ValueRow key={row.label} title={row.label} value={row.value} />
					))}
				</M3Section>
			</ScrollView>
		</>
	);
}
