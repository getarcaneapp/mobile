/** Android rendering of `ContainerInspectView`. */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { monoFamily } from '@/ui/components/type-scale';

import { AndroidToolbar } from './android-toolbar';
import { CenteredMessage } from './android-material';
import { useContainerInspect } from './use-container-inspect';

export function ContainerInspectScreen() {
	const router = useRouter();
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const model = useContainerInspect(envID, id);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Inspect',
					headerSearchBarOptions: {
						placeholder: 'Filter lines',
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onClose: () => model.setSearchText('')
					}
				}}
			/>
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'copy',
						icon: 'doc.on.doc',
						label: 'Copy',
						disabled: model.rawJSON === '',
						onPress: () => void model.copy()
					},
					{
						kind: 'button',
						id: 'done',
						icon: 'checkmark',
						label: 'Done',
						onPress: () => router.back()
					}
				]}
			/>
			<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
				{model.isLoading && model.rawJSON === '' ? (
					<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
						<ArcaneLoadingView label="Loading inspect…" />
					</View>
				) : model.errorMessage !== undefined && model.rawJSON === '' ? (
					<CenteredMessage
						icon="exclamationmark.triangle"
						title="Couldn't Load Inspect"
						message={model.errorMessage}
						action={{ title: 'Retry', onPress: () => void model.load() }}
					/>
				) : (
					<ScrollView contentContainerStyle={{ padding: 16 }}>
						<Text selectable style={{ fontFamily: monoFamily, fontSize: 14, color: colors.label }}>
							{model.displayedJSON}
						</Text>
					</ScrollView>
				)}
			</View>
		</>
	);
}
