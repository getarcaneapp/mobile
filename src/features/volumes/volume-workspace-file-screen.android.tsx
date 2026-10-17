import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { ToastHost } from '@/ui/toast';

import { CenteredMessage, TextButtonRow } from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';

import { useVolumeWorkspaceFile, type WorkspaceReviewPayload } from './use-volume-workspace-file';
import { routePayloads } from './volume-routes';

export function VolumeWorkspaceFileScreen() {
	const {
		name = '',
		envID = '0',
		relativePath = ''
	} = useLocalSearchParams<{ name?: string; envID?: string; relativePath?: string }>();
	const model = useVolumeWorkspaceFile(envID, name, relativePath);

	const toolbar: AndroidToolbarItem[] = [
		model.downloaded
			? {
					kind: 'button',
					id: 'share',
					icon: 'square.and.arrow.up',
					label: 'Share',
					onPress: model.share
				}
			: {
					kind: 'button',
					id: 'download',
					icon: 'square.and.arrow.down',
					label: 'Download',
					disabled: model.loading,
					onPress: model.download
				}
	];
	if (model.canEdit)
		toolbar.push({
			kind: 'button',
			id: 'save',
			icon: 'checkmark',
			label: 'Save',
			disabled: !model.canSave,
			onPress: model.save
		});

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
			<Stack.Screen options={{ title: model.file.name, gestureEnabled: !model.hasChanges }} />
			<AndroidToolbar items={toolbar} />
			{model.hasChanges ? (
				<AndroidToolbar
					placement="left"
					items={[
						{
							kind: 'button',
							id: 'discard',
							icon: 'xmark',
							label: 'Discard',
							onPress: model.dismiss
						}
					]}
				/>
			) : null}
			{model.errorMessage !== undefined ? (
				<Text
					style={[
						m3Type.bodyMedium,
						{ color: systemColors.red, paddingHorizontal: 16, paddingTop: 8 }
					]}
				>
					{model.errorMessage}
				</Text>
			) : null}
			{model.readOnlyReason !== undefined ? (
				<Text
					style={[m3Type.bodySmall, { color: colors.label, paddingHorizontal: 16, paddingTop: 4 }]}
				>{`Read only: ${model.readOnlyReason}`}</Text>
			) : null}
			{model.loading ? (
				<View style={{ padding: 16, alignItems: 'center' }}>
					<ArcaneLoadingView />
				</View>
			) : null}
			{model.hasText ? (
				<TextInput
					value={model.draft.text}
					onChangeText={model.setText}
					editable={model.canEdit && !model.loading}
					multiline
					autoCapitalize="none"
					autoCorrect={false}
					textAlignVertical="top"
					style={{
						flex: 1,
						padding: 16,
						fontFamily: monoFamily,
						fontSize: 14,
						color: colors.label
					}}
				/>
			) : !model.loading ? (
				<CenteredMessage
					icon="doc"
					title="Preview Unavailable"
					message="Download this file to open it in another app."
				/>
			) : null}
			{model.draft.conflict ? (
				<TextButtonRow title="Review server version" onPress={model.reviewConflict} />
			) : null}
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}

export function VolumeWorkspaceReviewScreen() {
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [payload] = useState(() => routePayloads.get<WorkspaceReviewPayload>(token));
	const latest = payload?.latest;
	return (
		<>
			<Stack.Screen options={{ title: 'Server version' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'keep',
						icon: 'checkmark',
						label: 'Keep my draft',
						disabled: latest?.editable !== true,
						onPress: () => {
							payload?.onKeep();
							routePayloads.delete(token);
							router.back();
						}
					}
				]}
			/>
			<ScrollView style={{ backgroundColor: colors.systemBackground }}>
				<Text
					selectable
					style={{ padding: 16, fontFamily: monoFamily, fontSize: 14, color: colors.label }}
				>
					{latest?.content ?? 'No text content'}
				</Text>
			</ScrollView>
		</>
	);
}
