import { Host } from '@/ui/host';
import {
	Button,
	ContextMenu,
	HStack,
	Label,
	List,
	ProgressView,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import {
	buttonStyle,
	disabled,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	listStyle,
	multilineTextAlignment,
	padding,
	refreshable,
	tint
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';

import type { TemplateRegistry } from '@/sdk/models/template/Template';
import { systemColors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { DestructiveLabel, ResourceCountSectionHeader } from '@/ui/components/labels';
import { RowIcon } from '@/ui/components/row-icon';
import { RowPreviewCard } from '@/ui/components/row-preview-card';
import { AppToolbar } from '@/ui/components/toolbar';

import { UnavailableView } from '@/ui/components/unavailable-view';

import {
	communityRegistryURL,
	templateRegistryDetails,
	useTemplateRegistries,
	type TemplateRegistriesModel
} from './use-template-registries';

export function TemplateRegistryRow({ registry }: { registry: TemplateRegistry }) {
	return (
		<HStack spacing={12} modifiers={[padding({ vertical: 2 })]}>
			<RowIcon systemImage="doc.text.fill" tint={systemColors.indigo} />
			<VStack alignment="leading" spacing={3}>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{registry.name}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{registry.url}
				</Text>
				{registry.lastFetchError ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle(systemColors.red),
							multilineTextAlignment('leading'),
							fixedSize({ horizontal: false, vertical: true })
						]}
					>
						{registry.lastFetchError}
					</Text>
				) : null}
			</VStack>
			<Spacer />
			{!registry.enabled ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					Disabled
				</Text>
			) : null}
		</HStack>
	);
}

function PressableTemplateRegistryRow({
	model,
	registry
}: {
	model: TemplateRegistriesModel;
	registry: TemplateRegistry;
}) {
	const row = model.canUpdateRegistries ? (
		<Button onPress={() => model.openEdit(registry)} modifiers={[buttonStyle('plain')]}>
			<TemplateRegistryRow registry={registry} />
		</Button>
	) : (
		<TemplateRegistryRow registry={registry} />
	);
	return (
		<SwipeActions>
			<ContextMenu>
				<ContextMenu.Trigger>{row}</ContextMenu.Trigger>
				<ContextMenu.Items>
					{model.canUpdateRegistries ? (
						<Button label="Edit" systemImage="pencil" onPress={() => model.openEdit(registry)} />
					) : null}
					{model.canDeleteRegistries ? (
						<Button
							role="destructive"
							onPress={() => model.requestDelete(registry)}
							modifiers={[tint(systemColors.red)]}
						>
							<DestructiveLabel text="Delete" />
						</Button>
					) : null}
				</ContextMenu.Items>
				<ContextMenu.Preview>
					<RowPreviewCard
						icon="doc.text.fill"
						iconColor={systemColors.indigo}
						title={registry.name}
						badges={[
							{
								text: registry.enabled ? 'Enabled' : 'Disabled',
								color: registry.enabled ? systemColors.green : systemColors.gray
							}
						]}
						details={templateRegistryDetails(registry)}
					/>
				</ContextMenu.Preview>
			</ContextMenu>
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				{model.canDeleteRegistries ? (
					<Button
						label="Delete"
						systemImage="trash"
						onPress={() => model.requestDelete(registry)}
						modifiers={[tint(systemColors.red)]}
					/>
				) : null}
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

export function TemplateRegistriesScreen() {
	const model = useTemplateRegistries();

	let content;
	if (!model.canViewRegistries) {
		content = (
			<UnavailableView
				title="Permission Required"
				systemImage="lock.fill"
				description="Your role cannot view template registries."
			/>
		);
	} else if (model.isLoading && model.registries.length === 0) {
		content = (
			<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
				<ArcaneLoadingViewSwiftUI label="Loading template registries..." />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && model.registries.length === 0) {
		content = (
			<UnavailableView
				title="Couldn't Load Template Registries"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: model.retry }]}
			/>
		);
	} else if (model.registries.length === 0) {
		content = (
			<UnavailableView
				title="No Template Registries"
				systemImage="doc.text"
				description="Add a registry to browse and deploy ready-made project templates."
				actions={
					model.canCreateRegistries
						? [
								{
									title: 'Add Community Registry',
									onPress: model.addCommunityRegistry,
									disabled: model.isAddingCommunity,
									isBusy: model.isAddingCommunity
								},
								{ title: 'Add Custom Registry', onPress: model.openCreate }
							]
						: []
				}
			/>
		);
	} else {
		content = (
			<List modifiers={[listStyle('insetGrouped'), refreshable(model.refresh)]}>
				<Section
					header={
						<ResourceCountSectionHeader
							title="Template Registries"
							loadedCount={model.registries.length}
						/>
					}
				>
					{model.registries.map((registry) => (
						<PressableTemplateRegistryRow key={registry.id} model={model} registry={registry} />
					))}
				</Section>
				{model.canCreateRegistries && !model.hasCommunityRegistry ? (
					<Section
						footer={<Text>{`Official Arcane community templates (${communityRegistryURL}).`}</Text>}
					>
						<Button
							onPress={model.addCommunityRegistry}
							modifiers={[disabled(model.isAddingCommunity)]}
						>
							<HStack>
								<Label title="Add Community Registry" systemImage="person.2" />
								<Spacer />
								{model.isAddingCommunity ? <ProgressView /> : null}
							</HStack>
						</Button>
					</Section>
				) : null}
			</List>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: 'Template Registries' }} />
			{model.canCreateRegistries ? (
				<AppToolbar>
					<Stack.Toolbar.Button
						icon="plus"
						accessibilityLabel="Add Template Registry"
						onPress={model.openCreate}
					/>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>{content}</Host>
		</>
	);
}
