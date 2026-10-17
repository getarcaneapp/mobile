import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import type { Template, TemplateContent } from '@/sdk/models/template/Template';
import { colors, systemColors } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { environmentActionIsMenu, environmentTitle } from '@/ui/components/environment-label.types';
import { ScrollableTabBar } from '@/ui/components/scrollable-tab-bar';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { AndroidToolbar, type AndroidToolbarItem } from '../shared/android-toolbar';
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

function SummaryBadge({ title, icon, tint }: { title: string; icon: string; tint?: string }) {
	const color = tint ?? (colors.secondaryLabel as string);
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 6,
				paddingHorizontal: 10,
				paddingVertical: 7,
				borderRadius: Radius.nested,
				backgroundColor: '#8E8E9314'
			}}
		>
			<Icon name={icon} size={14} color={color} />
			<Text style={[m3Type.labelMedium, { color }]}>{title}</Text>
		</View>
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
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			style={{ flexGrow: 0 }}
			contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}
			accessible
			accessibilityLabel={templateSummaryAccessibility(template, content)}
		>
			<View style={{ gap: 6 }}>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					<SummaryBadge
						title={template.isRemote ? 'Remote' : 'Local'}
						icon={template.isRemote ? 'cloud.fill' : 'internaldrive.fill'}
						tint={template.isRemote ? systemColors.blue : systemColors.indigo}
					/>
					{author ? <SummaryBadge title={author} icon="person.fill" /> : null}
					{version ? <SummaryBadge title={version} icon="tag.fill" /> : null}
					{tags.slice(0, 3).map((tag) => (
						<SummaryBadge key={tag} title={tag} icon="number" />
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
				</View>
				{content.services.length > 0 ? (
					<Text
						numberOfLines={1}
						style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
					>{`Services: ${content.services.join(', ')}`}</Text>
				) : null}
				{content.envVariables.length > 0 ? (
					<Text numberOfLines={1} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{`Variables: ${content.envVariables.map((variable) => variable.key).join(', ')}`}
					</Text>
				) : null}
			</View>
		</ScrollView>
	);
}

function toolbarItems(model: TemplatePreviewModel): AndroidToolbarItem[] {
	const items: AndroidToolbarItem[] = [];
	if (model.canDeploy) {
		const disabled = model.content === undefined || model.isDownloading;
		if (model.allEnvironmentsPreview && environmentActionIsMenu(model.deployEnvironments)) {
			items.push({
				kind: 'menu',
				id: 'deploy',
				icon: 'play.circle.fill',
				label: 'Deploy',
				disabled,
				items: model.deployEnvironments.map((environment) => ({
					id: environment.id,
					title: environmentTitle(environment),
					onPress: () => model.deploy(environment.id)
				}))
			});
		} else {
			items.push({
				kind: 'button',
				id: 'deploy',
				icon: 'play.circle.fill',
				label: 'Deploy',
				disabled,
				onPress: () => model.deploy(model.deployEnvironments[0]?.id ?? model.activeEnvironmentID)
			});
		}
	}
	if (model.isRemote && model.canDownload) {
		items.push(
			model.isDownloading
				? { kind: 'spinner', id: 'download', label: 'Downloading template' }
				: {
						kind: 'button',
						id: 'download',
						icon: 'arrow.down.circle',
						label: 'Download template',
						onPress: model.download
					}
		);
	}
	if (!model.isRemote && (model.canEdit || model.canDelete)) {
		items.push({
			kind: 'menu',
			id: 'actions',
			icon: 'ellipsis.circle',
			label: 'Template Actions',
			disabled: model.content === undefined || model.isDeleting,
			items: [
				...(model.canEdit
					? [{ id: 'edit', title: 'Edit Template', onPress: model.editTemplate }]
					: []),
				...(model.canDelete
					? [
							{
								id: 'delete',
								title: 'Delete Template',
								destructive: true,
								onPress: model.requestDelete
							}
						]
					: [])
			]
		});
	}
	return items;
}

export function TemplatePreviewScreen() {
	const model = useTemplatePreview();
	const items = toolbarItems(model);

	let content;
	if (model.isLoading && model.content === undefined) {
		content = (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
				<ArcaneLoadingView label="Loading template…" />
			</View>
		);
	} else if (model.errorMessage !== undefined && model.content === undefined) {
		content = (
			<UnavailableView
				title="Couldn't Load Template"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Try Again', onPress: model.loadContent }]}
			/>
		);
	} else if (model.content && model.displayedTemplate) {
		content = (
			<>
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
			</>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
			<Stack.Screen options={{ title: model.title }} />
			{items.length > 0 ? <AndroidToolbar items={items} /> : null}
			{content}
		</View>
	);
}
