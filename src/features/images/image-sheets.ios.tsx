import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	ProgressView,
	ScrollView,
	Section,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	scaleEffect,
	textInputAutocapitalization,
	textSelection,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { BoundTextField } from '@/features/containers/swiftui-text-field';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormPicker, FormTextField } from '@/ui/components/form-fields';
import { DestructiveLabel } from '@/ui/components/labels';

import {
	byteString,
	imagePruneModeDescription,
	ImagePruneModes,
	type ImagePruneMode
} from './image-model';
import { useImagePrune, useImageTag, usePullImage, useUploadImage } from './use-image-sheets';

type Params = { envID?: string; id?: string };

const filePath = (uri: string) => {
	const path = uri.replace(/^file:\/\//, '');
	try {
		return decodeURIComponent(path);
	} catch {
		return path;
	}
};

export function PullImageScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const { envID = '0' } = useLocalSearchParams<Params>();
	const model = usePullImage(envID);
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[navigationTitle('Pull Image'), navigationBarTitleDisplayMode('inline')]}
					>
						<Section title="Pull Image">
							<FormTextField
								title="Image"
								placeholder="nginx:latest"
								text={model.imageName}
								onChangeText={model.setImageName}
								autocapitalization="never"
								autocorrectionDisabled
								helper="Include a tag when you do not want Docker to assume latest."
							/>
						</Section>
						<Section title="Search Docker Hub">
							<BoundTextField
								placeholder="Search repositories"
								value={model.searchTerm}
								onChangeText={model.setSearchTerm}
								modifiers={[textInputAutocapitalization('never'), autocorrectionDisabled()]}
							/>
							{model.searching ? <ProgressView /> : null}
							{model.searchError ? (
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									{model.searchError}
								</Text>
							) : null}
							{model.searchResults.map((result) => (
								<Button key={result.name} onPress={() => model.setImageName(result.name)}>
									<VStack alignment="leading">
										<Text>{result.name}</Text>
										<Text modifiers={[font({ textStyle: 'caption' }), lineLimit(2)]}>
											{result.description}
										</Text>
										<Text
											modifiers={[
												font({ textStyle: 'caption' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' })
											]}
										>
											{`${result.starCount} stars${result.official ? ' · Official' : ''}`}
										</Text>
									</VStack>
								</Button>
							))}
						</Section>
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Pull"
								onPress={model.startPull}
								modifiers={[disabled(!model.canPull), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

export function UploadImageScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const { envID = '0' } = useLocalSearchParams<Params>();
	const model = useUploadImage(envID);
	const { picked } = model;
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[navigationTitle('Upload Image'), navigationBarTitleDisplayMode('inline')]}
					>
						<Section
							header={<Text>File</Text>}
							footer={
								<Text>
									Accepts .tar, .tar.gz, .tgz, .tar.xz. Server enforces a max size (default 500 MB).
								</Text>
							}
						>
							{picked ? (
								<>
									<VStack alignment="leading" spacing={4}>
										<Text modifiers={[font({ textStyle: 'subheadline' })]}>{picked.name}</Text>
										<Text
											modifiers={[
												font({ textStyle: 'caption' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' })
											]}
										>
											{byteString(picked.size)}
										</Text>
										<Text
											modifiers={[
												font({ textStyle: 'caption2', design: 'monospaced' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
												lineLimit(2)
											]}
										>
											{filePath(picked.uri)}
										</Text>
									</VStack>
									<Button
										label="Change file…"
										onPress={model.pickFile}
										modifiers={[disabled(model.isUploading)]}
									/>
								</>
							) : (
								<Button onPress={model.pickFile}>
									<Label title="Choose tarball…" systemImage="doc.zipper" />
								</Button>
							)}
						</Section>
						{model.isUploading ? (
							<Section title="Progress">
								<VStack alignment="leading" spacing={4}>
									<ArcaneLoadingViewSwiftUI />
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										Uploading…
									</Text>
								</VStack>
							</Section>
						) : null}
						{model.output ? (
							<Section title="Result">
								<ScrollView modifiers={[frame({ maxHeight: 200 })]}>
									<Text
										modifiers={[
											font({ textStyle: 'caption', design: 'monospaced' }),
											frame({ maxWidth: Infinity, alignment: 'leading' }),
											textSelection(true)
										]}
									>
										{model.output}
									</Text>
								</ScrollView>
							</Section>
						) : null}
						{model.errorMessage ? (
							<Section>
								<Label
									title={model.errorMessage}
									systemImage="exclamationmark.triangle"
									modifiers={[foregroundStyle(systemColors.red)]}
								/>
							</Section>
						) : null}
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button
								label={model.isUploading ? 'Stop' : 'Cancel'}
								onPress={model.isUploading ? model.stop : model.dismiss}
								modifiers={toolbarSymbol}
							/>
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							{model.output !== undefined ? (
								<Button label="Done" onPress={model.dismiss} modifiers={toolbarSymbol} />
							) : (
								<Button
									onPress={model.upload}
									modifiers={[
										disabled(picked === undefined || model.isUploading),
										...toolbarSymbol
									]}
								>
									{model.isUploading ? (
										<ProgressView modifiers={[scaleEffect(0.8)]} />
									) : (
										<Text>Upload</Text>
									)}
								</Button>
							)}
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

export function ImagePruneScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const { envID = '0' } = useLocalSearchParams<Params>();
	const model = useImagePrune(envID);
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[navigationTitle('Prune Images'), navigationBarTitleDisplayMode('inline')]}
					>
						<Section footer={<Text>{imagePruneModeDescription(model.mode)}</Text>}>
							<FormPicker<ImagePruneMode>
								title="Prune Mode"
								selection={model.mode}
								onSelectionChange={model.setMode}
								options={ImagePruneModes.map((mode) => ({ label: mode.title, value: mode.value }))}
							/>
						</Section>
						{model.mode === 'olderThan' ? (
							<Section title="Age Limit">
								<FormTextField
									title="Older Than"
									placeholder="24h or 7d"
									text={model.until}
									onChangeText={model.setUntil}
									autocapitalization="never"
									autocorrectionDisabled
									helper="Only unused images older than this duration will be pruned."
								/>
							</Section>
						) : null}
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							{model.isPruning ? (
								<ProgressView modifiers={[scaleEffect(0.8)]} />
							) : (
								<Button
									role="destructive"
									onPress={model.prune}
									modifiers={[tint(systemColors.red)]}
								>
									<DestructiveLabel text="Prune" />
								</Button>
							)}
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

export function ImageTagScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const { envID = '0', id = '' } = useLocalSearchParams<Params>();
	const model = useImageTag(envID, id);
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !model.saving }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[
								navigationTitle('Tag Image'),
								textInputAutocapitalization('never'),
								autocorrectionDisabled()
							]}
						>
							<BoundTextField
								placeholder="Repository"
								value={model.repository}
								onChangeText={model.setRepository}
							/>
							<BoundTextField
								placeholder="Tag (latest when empty)"
								value={model.tag}
								onChangeText={model.setTag}
							/>
							{model.saving ? <ProgressView /> : null}
						</Form>
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.saving), ...toolbarSymbol]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Save"
									onPress={model.save}
									modifiers={[disabled(!model.canSave), ...toolbarSymbol]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}
