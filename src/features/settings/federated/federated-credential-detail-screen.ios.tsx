import { Host } from '@/ui/host';
import { LabeledContent, List, Section, Text } from '@expo/ui/swift-ui';
import { listStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { AppToolbar } from '@/ui/components/toolbar';

import {
	accessRows,
	trustRuleRows,
	useFederatedCredentialDetail,
	type DetailRowValue
} from './use-federated-credential-detail';

function Rows({ rows }: { rows: DetailRowValue[] }) {
	return (
		<>
			{rows.map((row) => (
				<LabeledContent key={row.label} label={row.label}>
					<Text>{row.value}</Text>
				</LabeledContent>
			))}
		</>
	);
}

export function FederatedCredentialDetailScreen() {
	const { credential, canEdit, edit } = useFederatedCredentialDetail();
	if (!credential) return null;
	return (
		<>
			<Stack.Screen options={{ title: credential.name }} />
			{canEdit ? (
				<AppToolbar>
					<Stack.Toolbar.Button onPress={edit}>Edit</Stack.Toolbar.Button>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					<Section title="Trust rule">
						<Rows rows={trustRuleRows(credential)} />
					</Section>
					<Section title="Access">
						<Rows rows={accessRows(credential)} />
					</Section>
				</List>
			</Host>
		</>
	);
}
