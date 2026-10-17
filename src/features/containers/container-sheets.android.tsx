/** Android renderings of the rename, commit, and generated-compose sheets. */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, Text, TextInput, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3Type, monoFamily } from '@/ui/components/type-scale';

import { AndroidToolbar } from './android-toolbar';
import { CenteredMessage, M3Section, M3TextField, SwitchRow } from './android-material';
import {
	useContainerCommit,
	useContainerCompose,
	useRenameContainer
} from './use-container-sheets';

type Params = { id?: string; envID?: string; name?: string };

export function RenameContainerScreen() {
	const { id = '', envID = '0', name = '' } = useLocalSearchParams<Params>();
	const model = useRenameContainer(envID, id, name);
	return (
		<>
			<Stack.Screen options={{ title: 'Rename Container' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'save',
						icon: 'checkmark',
						label: 'Save',
						disabled: !model.canSave,
						onPress: model.submit
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section
					title="New name"
					footer="Must start with a letter or digit, and contain only letters, digits, underscores, dots, or hyphens."
				>
					<M3TextField
						label="Container Name"
						value={model.newName}
						onChangeText={model.setNewName}
					/>
				</M3Section>
				{model.errorMessage ? (
					<Text style={[m3Type.bodyMedium, { color: systemColors.red, padding: 16 }]}>
						{model.errorMessage}
					</Text>
				) : null}
			</ScrollView>
		</>
	);
}

export function ContainerCommitScreen() {
	const { id = '', envID = '0' } = useLocalSearchParams<Params>();
	const model = useContainerCommit(envID, id);
	const { fields, set } = model;
	return (
		<>
			<Stack.Screen options={{ title: 'Commit to Image' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'commit',
						icon: 'checkmark',
						label: 'Commit',
						disabled: !model.canSubmit,
						onPress: model.commit
					}
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Image">
					<M3TextField
						label="Repository"
						value={fields.repository}
						onChangeText={set.setRepository}
					/>
					<M3TextField label="Tag" value={fields.tag} onChangeText={set.setTag} />
					<M3TextField
						label="Author (optional)"
						value={fields.author}
						onChangeText={set.setAuthor}
					/>
					<M3TextField
						label="Comment (optional)"
						value={fields.comment}
						onChangeText={set.setComment}
						multiline
					/>
				</M3Section>
				<M3Section
					title="Commit options"
					footer="Mounted volume contents are excluded from the image."
				>
					<SwitchRow
						title="Pause container during commit"
						value={fields.pause}
						onValueChange={set.setPause}
					/>
					<M3TextField
						label="Dockerfile instructions, one per line (optional)"
						value={fields.changes}
						onChangeText={set.setChanges}
						multiline
					/>
				</M3Section>
				{model.busy ? (
					<View style={{ padding: 16, alignItems: 'center' }}>
						<ArcaneLoadingView label="Creating image…" />
					</View>
				) : null}
			</ScrollView>
		</>
	);
}

export function ContainerComposeScreen() {
	const { envID = '0', ids = '' } = useLocalSearchParams<{ envID?: string; ids?: string }>();
	const model = useContainerCompose(envID, ids.split(','));
	return (
		<>
			<Stack.Screen options={{ title: 'Generated Compose' }} />
			<AndroidToolbar
				items={[
					...(!model.loading && model.error === undefined
						? [
								{
									kind: 'button' as const,
									id: 'share',
									icon: 'square.and.arrow.up',
									label: 'Share',
									onPress: () => void Share.share({ message: model.content })
								}
							]
						: []),
					{ kind: 'button', id: 'done', icon: 'checkmark', label: 'Done', onPress: model.done }
				]}
			/>
			{model.loading ? (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
					<ArcaneLoadingView label="Generating Compose…" />
				</View>
			) : model.error !== undefined ? (
				<CenteredMessage
					icon="exclamationmark.triangle"
					title="Compose unavailable"
					message={model.error}
				/>
			) : (
				<TextInput
					value={model.content}
					onChangeText={model.setContent}
					multiline
					autoCapitalize="none"
					autoCorrect={false}
					textAlignVertical="top"
					style={{
						flex: 1,
						padding: 16,
						fontFamily: monoFamily,
						fontSize: 14,
						color: colors.label,
						backgroundColor: colors.systemBackground
					}}
				/>
			)}
		</>
	);
}
