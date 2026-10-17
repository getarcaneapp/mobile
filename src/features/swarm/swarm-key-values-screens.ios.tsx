import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	LabeledContent,
	List,
	NavigationStack,
	Section,
	Spacer,
	SwipeActions,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	autocorrectionDisabled,
	buttonStyle,
	disabled,
	font,
	foregroundStyle,
	frame,
	listStyle,
	navigationBarTitleDisplayMode,
	navigationTitle,
	refreshable,
	scrollEdgeEffectStyle,
	textInputAutocapitalization,
	textSelection,
	tint,
	contentShape,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import { systemColors } from '@/theme/colors';
import { FormSecureField, FormTextField } from '@/ui/components/form-fields';
import { ResourceActionsToolbar } from '@/ui/components/toolbar';
import { DisclosureChevron } from '@/ui/settings-row';
import { useToolbarIcons } from '@/ui/toolbar-icon';
import { AppToolbar } from '@/ui/app-toolbar';

import { BoundTextField } from '@/features/containers/swiftui-text-field';

import { CopyValueRow, SwarmListState } from './swarm-parts';
import {
	itemName,
	KeyValueKind,
	useSwarmKeyValueCreate,
	useSwarmKeyValueDetail,
	useSwarmKeyValues
} from './use-swarm-key-values';

export function SwarmKeyValuesScreen() {
	const model = useSwarmKeyValues();
	const icon = useToolbarIcons(['plus']);
	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					headerSearchBarOptions: {
						placeholder: `Search ${model.title.toLowerCase()}`,
						hideWhenScrolling: false,
						onChangeText: (event) => model.setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => model.setSearchText('')
					}
				}}
			/>
			{model.canManage ? (
				<AppToolbar placement="right">
					<AppToolbar.Button
						icon={icon('plus')}
						accessibilityLabel={`Create ${KeyValueKind.singular(model.kind)}`}
						onPress={model.openCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<SwarmListState
					isLoading={model.isLoading}
					isEmpty={model.items.length === 0}
					errorMessage={model.errorMessage}
					emptyTitle={`No ${model.title}`}
					emptySystemImage={KeyValueKind.systemImage(model.kind)}
					retry={() => void model.load()}
				>
					<List
						modifiers={[
							listStyle('insetGrouped'),
							scrollEdgeEffectStyle('soft', 'top'),
							refreshable(model.load)
						]}
					>
						<Section header={<Text>{model.headerText}</Text>}>
							{model.displayedItems.map((item) => {
								const link = (
									<Button
										onPress={() => model.openDetail(item)}
										modifiers={[buttonStyle('plain'), contentShape(shapes.rectangle())]}
									>
										<HStack>
											<VStack alignment="leading" spacing={3}>
												<Text>{itemName(item)}</Text>
												<Text
													modifiers={[
														font({ textStyle: 'caption' }),
														foregroundStyle({ type: 'hierarchical', style: 'secondary' })
													]}
												>
													{model.updatedText(item)}
												</Text>
											</VStack>
											<Spacer />
											<DisclosureChevron />
										</HStack>
									</Button>
								);
								if (!model.canManage) return <VStack key={item.id}>{link}</VStack>;
								return (
									<SwipeActions key={item.id}>
										{link}
										<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
											<Button
												label="Delete"
												systemImage="trash"
												onPress={() => model.requestDelete(item)}
												modifiers={[tint(systemColors.red)]}
											/>
										</SwipeActions.Actions>
									</SwipeActions>
								);
							})}
						</Section>
					</List>
				</SwarmListState>
			</Host>
		</>
	);
}

export function SwarmKeyValueDetailScreen() {
	const model = useSwarmKeyValueDetail();
	const { item } = model;
	if (!item) return <Stack.Screen options={{ title: '' }} />;
	return (
		<>
			<Stack.Screen options={{ title: model.name, headerLargeTitleEnabled: false }} />
			<ResourceActionsToolbar
				overflow={model.toolbar.overflow}
				runningItemID={model.toolbar.runningItemID}
				isDisabled={model.toolbar.isDisabled}
				resourceName={model.name}
				active={model.canManage}
			/>
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped'), scrollEdgeEffectStyle('soft', 'top')]}>
					<Section title="Details">
						<LabeledContent label="Name">
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{model.name}
							</Text>
						</LabeledContent>
						<CopyValueRow title="ID" value={item.id} />
						<LabeledContent label="Created">
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{model.createdText}
							</Text>
						</LabeledContent>
						<LabeledContent label="Updated">
							<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
								{model.updatedText}
							</Text>
						</LabeledContent>
					</Section>
					{model.kind === 'config' ? (
						<Section title="Data">
							{model.data !== undefined ? (
								<Text
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										textSelection(true)
									]}
								>
									{model.data}
								</Text>
							) : (
								<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
									Binary or empty data.
								</Text>
							)}
						</Section>
					) : (
						<Section>
							<Label
								title="Secret values can't be read back from Docker."
								systemImage="lock.fill"
								modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
							/>
						</Section>
					)}
				</List>
			</Host>
		</>
	);
}

export function SwarmKeyValueCreateScreen() {
	const model = useSwarmKeyValueCreate();
	return (
		<>
			<Stack.Screen options={{ gestureEnabled: !model.dismissDisabled }} />
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<Form
							modifiers={[navigationTitle(model.title), navigationBarTitleDisplayMode('inline')]}
						>
							<Section>
								<FormTextField
									title="Name"
									placeholder={model.namePlaceholder}
									text={model.name}
									onChangeText={model.setName}
									autocapitalization="never"
									autocorrectionDisabled
								/>
							</Section>
							<Section
								header={<Text>{model.kind === 'config' ? 'Data' : 'Secret'}</Text>}
								footer={<Text>{model.footer}</Text>}
							>
								{model.kind === 'secret' ? (
									<FormSecureField
										title="Value"
										placeholder="Required"
										text={model.data}
										onChangeText={model.setData}
									/>
								) : (
									<BoundTextField
										placeholder=""
										value={model.data}
										onChangeText={model.setData}
										axis="vertical"
										modifiers={[
											font({ textStyle: 'caption', design: 'monospaced' }),
											textInputAutocapitalization('never'),
											autocorrectionDisabled(),
											frame({ minHeight: 220, alignment: 'topLeading' })
										]}
									/>
								)}
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
							<ToolbarItem placement="cancellationAction">
								<Button
									label="Cancel"
									onPress={model.cancel}
									modifiers={[disabled(model.isSaving)]}
								/>
							</ToolbarItem>
							<ToolbarItem placement="confirmationAction">
								<Button
									label="Create"
									onPress={model.create}
									modifiers={[disabled(!model.canCreate)]}
								/>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
		</>
	);
}
