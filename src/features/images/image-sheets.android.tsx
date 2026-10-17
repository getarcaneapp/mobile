/** Android renderings of the Pull, Upload, Prune, and Tag image sheets. */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import {
	M3Section,
	M3TextField,
	RadioGroup,
	TextButtonRow
} from '@/features/containers/android-material';
import { AndroidToolbar, type AndroidToolbarItem } from '@/features/containers/android-toolbar';
import { colors, systemColors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { FormTextField } from '@/ui/components/form-fields';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { byteString, imagePruneModeDescription, ImagePruneModes } from './image-model';
import { useImagePrune, useImageTag, usePullImage, useUploadImage } from './use-image-sheets';

type Params = { envID?: string; id?: string };

// Read per render: colors follow the current appearance.
const screenStyle = () => ({ backgroundColor: colors.systemGroupedBackground });

export function PullImageScreen() {
	const { envID = '0' } = useLocalSearchParams<Params>();
	const model = usePullImage(envID);
	return (
		<>
			<Stack.Screen options={{ title: 'Pull Image' }} />
			<AndroidToolbar
				items={[
					{
						kind: 'button',
						id: 'pull',
						icon: 'arrow.down.circle',
						label: 'Pull',
						disabled: !model.canPull,
						onPress: model.startPull
					}
				]}
			/>
			<ScrollView
				style={screenStyle()}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Pull Image">
					<FormTextField
						title="Image"
						placeholder="nginx:latest"
						text={model.imageName}
						onChangeText={model.setImageName}
						autocapitalization="never"
						autocorrectionDisabled
						helper="Include a tag when you do not want Docker to assume latest."
					/>
				</M3Section>
				<M3Section title="Search Docker Hub">
					<M3TextField
						label="Search repositories"
						value={model.searchTerm}
						onChangeText={model.setSearchTerm}
					/>
					{model.searching ? <ActivityIndicator style={{ padding: 12 }} /> : null}
					{model.searchError ? (
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, padding: 16 }]}>
							{model.searchError}
						</Text>
					) : null}
					{model.searchResults.map((result) => (
						<Pressable
							key={result.name}
							onPress={() => model.setImageName(result.name)}
							accessibilityRole="button"
							android_ripple={{ color: colors.separator as string }}
							style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}
						>
							<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{result.name}</Text>
							<Text numberOfLines={2} style={[m3Type.bodySmall, { color: colors.label }]}>
								{result.description}
							</Text>
							<Text
								style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
							>{`${result.starCount} stars${result.official ? ' · Official' : ''}`}</Text>
						</Pressable>
					))}
				</M3Section>
			</ScrollView>
		</>
	);
}

export function UploadImageScreen() {
	const { envID = '0' } = useLocalSearchParams<Params>();
	const model = useUploadImage(envID);
	const { picked } = model;
	const items: AndroidToolbarItem[] = model.isUploading
		? [
				{ kind: 'button', id: 'stop', icon: 'xmark', label: 'Stop', onPress: model.stop },
				{ kind: 'spinner', id: 'uploading', label: 'Uploading' }
			]
		: model.output !== undefined
			? [{ kind: 'button', id: 'done', icon: 'checkmark', label: 'Done', onPress: model.dismiss }]
			: [
					{
						kind: 'button',
						id: 'upload',
						icon: 'square.and.arrow.up',
						label: 'Upload',
						disabled: picked === undefined,
						onPress: model.upload
					}
				];
	return (
		<>
			<Stack.Screen options={{ title: 'Upload Image' }} />
			<AndroidToolbar items={items} />
			<ScrollView style={screenStyle()} contentContainerStyle={{ paddingBottom: 32 }}>
				<M3Section
					title="File"
					footer="Accepts .tar, .tar.gz, .tgz, .tar.xz. Server enforces a max size (default 500 MB)."
				>
					{picked ? (
						<>
							<View style={{ padding: 16, gap: 4 }}>
								<Text style={[m3Type.bodyMedium, { color: colors.label }]}>{picked.name}</Text>
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									{byteString(picked.size)}
								</Text>
								<Text
									numberOfLines={2}
									style={[
										m3Type.labelSmall,
										{ color: colors.secondaryLabel, fontFamily: monoFamily }
									]}
								>
									{picked.uri}
								</Text>
							</View>
							<TextButtonRow
								title="Change file…"
								onPress={model.pickFile}
								disabled={model.isUploading}
							/>
						</>
					) : (
						<Pressable
							onPress={model.pickFile}
							accessibilityRole="button"
							android_ripple={{ color: colors.separator as string }}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 16,
								minHeight: 52,
								paddingHorizontal: 16
							}}
						>
							<Icon name="doc.zipper" size={22} color={colors.secondaryLabel} />
							<Text style={[m3Type.bodyLarge, { color: colors.label }]}>Choose tarball…</Text>
						</Pressable>
					)}
				</M3Section>
				{model.isUploading ? (
					<M3Section title="Progress">
						<View style={{ padding: 16, gap: 4 }}>
							<ArcaneLoadingView />
							<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>Uploading…</Text>
						</View>
					</M3Section>
				) : null}
				{model.output ? (
					<M3Section title="Result">
						<ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
							<Text
								selectable
								style={{ padding: 16, fontFamily: monoFamily, fontSize: 12, color: colors.label }}
							>
								{model.output}
							</Text>
						</ScrollView>
					</M3Section>
				) : null}
				{model.errorMessage ? (
					<M3Section>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={20} color={systemColors.red} />
							<Text style={[m3Type.bodyMedium, { color: systemColors.red, flex: 1 }]}>
								{model.errorMessage}
							</Text>
						</View>
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}

export function ImagePruneScreen() {
	const { envID = '0' } = useLocalSearchParams<Params>();
	const model = useImagePrune(envID);
	return (
		<>
			<Stack.Screen options={{ title: 'Prune Images' }} />
			<AndroidToolbar
				items={[
					model.isPruning
						? { kind: 'spinner', id: 'prune', label: 'Pruning' }
						: {
								kind: 'button',
								id: 'prune',
								icon: 'trash',
								label: 'Prune',
								color: systemColors.red,
								onPress: model.prune
							}
				]}
			/>
			<ScrollView
				style={screenStyle()}
				contentContainerStyle={{ paddingBottom: 32 }}
				keyboardShouldPersistTaps="handled"
			>
				<M3Section title="Prune Mode" footer={imagePruneModeDescription(model.mode)}>
					<RadioGroup options={ImagePruneModes} selection={model.mode} onSelect={model.setMode} />
				</M3Section>
				{model.mode === 'olderThan' ? (
					<M3Section title="Age Limit">
						<FormTextField
							title="Older Than"
							placeholder="24h or 7d"
							text={model.until}
							onChangeText={model.setUntil}
							autocapitalization="never"
							autocorrectionDisabled
							helper="Only unused images older than this duration will be pruned."
						/>
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}

export function ImageTagScreen() {
	const { envID = '0', id = '' } = useLocalSearchParams<Params>();
	const model = useImageTag(envID, id);
	return (
		<>
			<Stack.Screen options={{ title: 'Tag Image', gestureEnabled: !model.saving }} />
			<AndroidToolbar
				items={[
					model.saving
						? { kind: 'spinner', id: 'save', label: 'Saving' }
						: {
								kind: 'button',
								id: 'save',
								icon: 'checkmark',
								label: 'Save',
								disabled: !model.canSave,
								onPress: model.save
							}
				]}
			/>
			<ScrollView style={screenStyle()} keyboardShouldPersistTaps="handled">
				<M3Section>
					<M3TextField
						label="Repository"
						value={model.repository}
						onChangeText={model.setRepository}
					/>
					<M3TextField
						label="Tag (latest when empty)"
						value={model.tag}
						onChangeText={model.setTag}
					/>
				</M3Section>
			</ScrollView>
		</>
	);
}
