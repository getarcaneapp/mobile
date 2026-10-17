/**
 * Ports of `RenameContainerSheet`, `ContainerCommitView`, and
 * `ContainerComposeView` (RenameContainerSheet.swift, ContainerImageActionsView.swift).
 */
import { Host } from '@/ui/host';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	ContentUnavailableView,
	Form,
	Label,
	NavigationStack,
	Section,
	ShareLink,
	Text,
	Toggle,
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
	padding,
	submitLabel,
	textInputAutocapitalization
} from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { FormTextField } from '@/ui/components/form-fields';
import { ToastHost } from '@/ui/toast';

import { BoundTextField } from './swiftui-text-field';
import {
	useContainerCommit,
	useContainerCompose,
	useRenameContainer
} from './use-container-sheets';

type Params = { id?: string; envID?: string; name?: string };

export function RenameContainerScreen() {
	const toolbarAccent = useAppAccentToolbarSymbol();
	const { id = '', envID = '0', name = '' } = useLocalSearchParams<Params>();
	const model = useRenameContainer(envID, id, name);
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[
							navigationTitle('Rename Container'),
							navigationBarTitleDisplayMode('inline')
						]}
					>
						<Section header={<Text>New name</Text>}>
							<FormTextField
								title="Container Name"
								placeholder={name}
								text={model.newName}
								onChangeText={model.setNewName}
								autocapitalization="never"
								autocorrectionDisabled
								helper="Must start with a letter or digit, and contain only letters, digits, underscores, dots, or hyphens."
							/>
						</Section>
						{model.errorMessage ? (
							<Section>
								<Label
									title={model.errorMessage}
									systemImage="exclamationmark.triangle.fill"
									modifiers={[foregroundStyle(systemColors.red), font({ textStyle: 'callout' })]}
								/>
							</Section>
						) : null}
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="topBarLeading">
							<Button
								label="Cancel"
								onPress={model.cancel}
								modifiers={[...toolbarAccent, disabled(model.isSubmitting)]}
							/>
						</ToolbarItem>
						<ToolbarItem placement="topBarTrailing">
							<Button
								label="Save"
								onPress={model.submit}
								modifiers={[...toolbarAccent, disabled(!model.canSave), submitLabel('done')]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

export function ContainerCommitScreen() {
	const toolbarAccent = useAppAccentToolbarSymbol();
	const { id = '', envID = '0' } = useLocalSearchParams<Params>();
	const model = useContainerCommit(envID, id);
	const { fields, set } = model;
	const field = (
		placeholder: string,
		value: string,
		onChange: (text: string) => void,
		axis?: 'vertical'
	) => (
		<BoundTextField placeholder={placeholder} value={value} onChangeText={onChange} axis={axis} />
	);
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form
						modifiers={[
							navigationTitle('Commit to Image'),
							textInputAutocapitalization('never'),
							autocorrectionDisabled()
						]}
					>
						<Section title="Image">
							{field('Repository', fields.repository, set.setRepository)}
							{field('Tag', fields.tag, set.setTag)}
							{field('Author (optional)', fields.author, set.setAuthor)}
							{field('Comment (optional)', fields.comment, set.setComment, 'vertical')}
						</Section>
						<Section title="Commit options">
							<Toggle
								label="Pause container during commit"
								isOn={fields.pause}
								onIsOnChange={set.setPause}
							/>
							{field(
								'Dockerfile instructions, one per line (optional)',
								fields.changes,
								set.setChanges,
								'vertical'
							)}
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								Mounted volume contents are excluded from the image.
							</Text>
						</Section>
						{model.busy ? <ArcaneLoadingViewSwiftUI label="Creating image…" /> : null}
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button
								label="Cancel"
								onPress={model.cancel}
								modifiers={[...toolbarAccent, disabled(model.busy)]}
							/>
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Commit"
								onPress={model.commit}
								modifiers={[...toolbarAccent, disabled(!model.canSubmit)]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

export function ContainerComposeScreen() {
	const toolbarAccent = useAppAccentToolbarSymbol();
	const { envID = '0', ids = '' } = useLocalSearchParams<{ envID?: string; ids?: string }>();
	const model = useContainerCompose(envID, ids.split(','));
	let body;
	if (model.loading) {
		body = (
			<VStack
				modifiers={[
					frame({ maxWidth: Infinity, maxHeight: Infinity }),
					navigationTitle('Generated Compose')
				]}
			>
				<ArcaneLoadingViewSwiftUI label="Generating Compose…" />
			</VStack>
		);
	} else if (model.error !== undefined) {
		body = (
			<ContentUnavailableView
				title="Compose unavailable"
				systemImage="exclamationmark.triangle"
				description={model.error}
				modifiers={[navigationTitle('Generated Compose')]}
			/>
		);
	} else {
		body = (
			<BoundTextField
				placeholder=""
				value={model.content}
				onChangeText={model.setContent}
				axis="vertical"
				modifiers={[
					font({ textStyle: 'body', design: 'monospaced' }),
					textInputAutocapitalization('never'),
					autocorrectionDisabled(),
					lineLimit(1000),
					padding({ all: 16 }),
					frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
					navigationTitle('Generated Compose')
				]}
			/>
		);
	}
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						{body}
						<Toolbar.Content>
							<ToolbarItem placement="cancellationAction">
								<Button label="Done" onPress={model.done} modifiers={toolbarAccent} />
							</ToolbarItem>
							{!model.loading && model.error === undefined ? (
								<ToolbarItem placement="primaryAction">
									<ShareLink item={model.content}>
										<Label title="Share" systemImage="square.and.arrow.up" />
									</ShareLink>
								</ToolbarItem>
							) : null}
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
