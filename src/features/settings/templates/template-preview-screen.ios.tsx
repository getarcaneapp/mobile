import { Host } from '@/ui/host';
import { HStack, Label, ScrollView, Text, VStack } from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	accessibilityLabel,
	background,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
	shapes
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { Template, TemplateContent } from '@/sdk/models/template/Template';
import { colors, systemColors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { AppToolbar } from '@/ui/components/toolbar';

import { UnavailableView } from '@/ui/components/unavailable-view';

import { CodeEditor } from '@/ui/components/code-editor';
import {
	plural,
	templateSummaryAccessibility,
	useTemplatePreview,
	type TemplateFileTab,
	type TemplatePreviewModel
} from './use-template-preview';

const fileTabs: { value: TemplateFileTab; title: string; systemImage: string; tint: string }[] = [
	{ value: 'compose', title: 'compose.yml', systemImage: 'doc.text.fill', tint: systemColors.blue },
	{ value: 'env', title: '.env', systemImage: 'key.fill', tint: systemColors.orange }
];

function SummaryBadge({ title, icon, tint }: { title: string; icon: string; tint: string }) {
	return (
		<Label
			title={title}
			systemImage={icon as SFSymbol}
			modifiers={[
				font({ textStyle: 'caption', weight: 'semibold' }),
				foregroundStyle(tint),
				padding({ horizontal: 10, vertical: 7 }),
				background(
					'#8E8E9314',
					shapes.roundedRectangle({ cornerRadius: Radius.nested, roundedCornerStyle: 'continuous' })
				)
			]}
		/>
	);
}

function TemplateContentSummary({
	template,
	content
}: {
	template: Template;
	content: TemplateContent;
}) {
	const author = template.metadata?.author;
	const version = template.metadata?.version;
	const tags = template.metadata?.tags ?? [];
	return (
		<Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
			<ScrollView
				axes="horizontal"
				showsIndicators={false}
				modifiers={[
					padding({ bottom: 6 }),
					accessibilityElement('combine'),
					accessibilityLabel(templateSummaryAccessibility(template, content))
				]}
			>
				<VStack
					alignment="leading"
					spacing={6}
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						padding({ horizontal: 16, top: 10 })
					]}
				>
					<HStack spacing={8}>
						<SummaryBadge
							title={template.isRemote ? 'Remote' : 'Local'}
							icon={template.isRemote ? 'cloud.fill' : 'internaldrive.fill'}
							tint={template.isRemote ? systemColors.blue : systemColors.indigo}
						/>
						{author ? <SummaryBadge title={author} icon="person.fill" tint="secondary" /> : null}
						{version ? <SummaryBadge title={version} icon="tag.fill" tint="secondary" /> : null}
						{tags.slice(0, 3).map((tag) => (
							<SummaryBadge key={tag} title={tag} icon="number" tint="secondary" />
						))}
						<SummaryBadge
							title={plural(content.services.length, 'service')}
							icon="shippingbox.fill"
							tint={systemColors.purple}
						/>
						<SummaryBadge
							title={plural(content.envVariables.length, 'variable')}
							icon="curlybraces"
							tint={systemColors.orange}
						/>
					</HStack>
					{content.services.length > 0 ? (
						<Text modifiers={[lineLimit(1)]}>{`Services: ${content.services.join(', ')}`}</Text>
					) : null}
					{content.envVariables.length > 0 ? (
						<Text
							modifiers={[lineLimit(1)]}
						>{`Variables: ${content.envVariables.map((variable) => variable.key).join(', ')}`}</Text>
					) : null}
				</VStack>
			</ScrollView>
		</Host>
	);
}

function PreviewToolbar({ model }: { model: TemplatePreviewModel }) {
	const deployDisabled = model.content === undefined || model.isDownloading;
	const actionsDisabled = model.content === undefined || model.isDeleting;
	return (
		<AppToolbar>
			{!model.isRemote && (model.canEdit || model.canDelete) ? (
				<Stack.Toolbar.Menu
					icon="ellipsis.circle"
					accessibilityLabel="Template Actions"
					disabled={actionsDisabled}
				>
					{model.canEdit ? (
						<Stack.Toolbar.MenuAction icon="pencil" onPress={model.editTemplate}>
							Edit Template
						</Stack.Toolbar.MenuAction>
					) : null}
					{model.canDelete ? (
						<Stack.Toolbar.MenuAction icon="trash" destructive onPress={model.requestDelete}>
							Delete Template
						</Stack.Toolbar.MenuAction>
					) : null}
				</Stack.Toolbar.Menu>
			) : null}
			{model.isRemote && model.canDownload ? (
				model.isDownloading ? (
					<Stack.Toolbar.View>
						<ActivityIndicator accessibilityLabel="Downloading template" />
					</Stack.Toolbar.View>
				) : (
					<Stack.Toolbar.Button
						icon="arrow.down.circle"
						accessibilityLabel="Download template"
						onPress={model.download}
					/>
				)
			) : null}
			{model.canDeploy ? (
				model.allEnvironmentsPreview && environmentActionIsMenu(model.deployEnvironments) ? (
					<Stack.Toolbar.Menu
						icon="play.circle.fill"
						accessibilityLabel="Deploy"
						disabled={deployDisabled}
					>
						{model.deployEnvironments.map((environment) => (
							<Stack.Toolbar.MenuAction
								key={environment.id}
								onPress={() => model.deploy(environment.id)}
							>
								{environmentTitle(environment)}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				) : (
					<Stack.Toolbar.Button
						icon="play.circle.fill"
						accessibilityLabel="Deploy"
						disabled={deployDisabled}
						onPress={() =>
							model.deploy(model.deployEnvironments[0]?.id ?? model.activeEnvironmentID)
						}
					/>
				)
			) : null}
		</AppToolbar>
	);
}

export function TemplatePreviewScreen() {
	const model = useTemplatePreview();

	let content;
	if (model.isLoading && model.content === undefined) {
		content = (
			<Host style={{ flex: 1 }}>
				<VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
					<ArcaneLoadingViewSwiftUI label="Loading template…" />
				</VStack>
			</Host>
		);
	} else if (model.errorMessage !== undefined && model.content === undefined) {
		content = (
			<Host style={{ flex: 1 }}>
				<UnavailableView
					title="Couldn't Load Template"
					systemImage="exclamationmark.triangle"
					description={model.errorMessage}
					actions={[{ title: 'Try Again', onPress: model.loadContent }]}
				/>
			</Host>
		);
	} else if (model.content && model.displayedTemplate) {
		content = (
			<View style={{ flex: 1 }}>
				<TemplateContentSummary template={model.displayedTemplate} content={model.content} />
				<ScrollableTabBar
					selection={model.selectedTab}
					onSelectionChange={model.setSelectedTab}
					options={fileTabs}
					accessibilityLabel="Template files"
				/>
				{model.selectedTab === 'compose' ? (
					<CodeEditor
						key="compose"
						text={model.content.content}
						language="yaml"
						readOnly
						accessibilityLabel="compose.yml"
					/>
				) : (
					<CodeEditor
						key="env"
						text={model.content.envContent}
						language="env"
						readOnly
						accessibilityLabel=".env"
					/>
				)}
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: model.title,
					headerLargeTitleEnabled: false,
					headerTransparent: false,
					headerShadowVisible: false,
					headerStyle: { backgroundColor: colors.systemGroupedBackground }
				}}
			/>
			<PreviewToolbar model={model} />
			{content ?? <View style={{ flex: 1 }} />}
		</>
	);
}
