import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	Circle,
	Form,
	HStack,
	Label,
	NavigationStack,
	ProgressView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	ZStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityAddTraits,
	accessibilityLabel,
	buttonStyle,
	controlSize,
	disabled,
	font,
	foregroundStyle,
	frame,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding
} from '@expo/ui/swift-ui/modifiers';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { FormTextField } from '@/ui/components/form-fields';

import { capitalized } from '@/features/containers/container-model';

import {
	projectTagColors,
	projectTagDisplayColor,
	projectTagIsComposeManaged
} from './project-model';
import { useProjectTags } from './use-project-tags';

export function ProjectTagsScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useProjectTags();
	const accent = useAccentColor();

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form modifiers={[navigationTitle('Tags'), navigationBarTitleDisplayMode('inline')]}>
						{model.rows.length > 0 ? (
							<Section
								header={<Text>Tags</Text>}
								footer={
									model.hasComposeManaged ? (
										<Text>Locked tags come from the compose file.</Text>
									) : undefined
								}
							>
								{model.rows.map((tag) => {
									const managed = projectTagIsComposeManaged(tag);
									return (
										<Button
											key={tag.name}
											onPress={() => model.toggle(tag)}
											modifiers={[disabled(managed || model.pendingName !== undefined)]}
										>
											<HStack spacing={10}>
												<Image
													systemName="tag.fill"
													modifiers={[foregroundStyle(projectTagDisplayColor(tag.color))]}
												/>
												<Text
													modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}
												>
													{tag.name}
												</Text>
												<Spacer minLength={0} />
												{model.pendingName === tag.name ? (
													<ProgressView modifiers={[controlSize('small')]} />
												) : managed ? (
													<Image
														systemName="lock.fill"
														modifiers={[
															foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
															accessibilityLabel('Managed by compose file')
														]}
													/>
												) : model.isAttached(tag) ? (
													<Image systemName="checkmark" modifiers={[foregroundStyle(accent)]} />
												) : null}
											</HStack>
										</Button>
									);
								})}
							</Section>
						) : null}
						<Section title="New Tag">
							<FormTextField
								title="Name"
								placeholder="production"
								text={model.newName}
								onChangeText={model.setNewName}
								autocapitalization="never"
								autocorrectionDisabled
							/>
							<HStack spacing={10} modifiers={[padding({ vertical: 4 })]}>
								{projectTagColors.map((color) => (
									<Button
										key={color}
										onPress={() => model.setNewColor(color)}
										modifiers={[
											buttonStyle('plain'),
											accessibilityLabel(capitalized(color)),
											...(model.newColor === color ? [accessibilityAddTraits(['isSelected'])] : [])
										]}
									>
										<ZStack>
											<Circle
												modifiers={[
													foregroundStyle(projectTagDisplayColor(color)),
													frame({ width: 24, height: 24 })
												]}
											/>
											{model.newColor === color ? (
												<Image
													systemName="checkmark"
													modifiers={[
														font({ textStyle: 'caption2', weight: 'bold' }),
														foregroundStyle('#FFFFFF')
													]}
												/>
											) : null}
										</ZStack>
									</Button>
								))}
							</HStack>
							<Button
								onPress={model.addTag}
								modifiers={[
									disabled(model.trimmedNewName === '' || model.pendingName !== undefined)
								]}
							>
								<Label title="Add Tag" systemImage="plus" />
							</Button>
						</Section>
						{model.errorMessage !== undefined ? (
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
						<ToolbarItem placement="confirmationAction">
							<Button label="Done" onPress={model.done} modifiers={toolbarSymbol} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
