import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Form,
	Label,
	NavigationStack,
	Picker,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import {
	foregroundStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	tag
} from '@expo/ui/swift-ui/modifiers';

import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';

import { useProjectFileDialog } from './use-project-file-dialog';

export function ProjectFileDialogScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useProjectFileDialog();
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}>
						{model.needsName ? (
							<Section title={model.nameSectionTitle}>
								<FormTextField
									title="Name"
									placeholder={model.namePlaceholder}
									text={model.name}
									onChangeText={model.setName}
									autocapitalization="never"
									autocorrectionDisabled
									monospaced
								/>
							</Section>
						) : null}
						{model.needsDestination ? (
							<Section title="Destination">
								<Picker
									label="Folder"
									selection={model.destinationPath}
									onSelectionChange={(value: string) => model.setDestinationPath(value)}
								>
									<Text modifiers={[tag('')]}>Project root</Text>
									{model.destinationFolders.map((folder) => (
										<Text key={folder.relativePath} modifiers={[tag(folder.relativePath)]}>
											{folder.relativePath}
										</Text>
									))}
								</Picker>
							</Section>
						) : null}
						{model.errorMessage !== undefined ? (
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
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
						<ToolbarItem placement="confirmationAction">
							<Button label={model.actionTitle} onPress={model.submit} modifiers={toolbarSymbol} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
