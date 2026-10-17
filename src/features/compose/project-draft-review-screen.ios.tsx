import {
	Button,
	DisclosureGroup,
	Form,
	Label,
	NavigationStack,
	ScrollView,
	Section,
	Text,
	Toolbar,
	ToolbarItem
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, navigationTitle, textSelection } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';

import { useProjectDraftReview } from './use-project-draft-review';

export function ProjectDraftReviewScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useProjectDraftReview();
	const [diffExpanded, setDiffExpanded] = useState(false);

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<Form modifiers={[navigationTitle('Review Changes')]}>
						<Section title="Changes">
							{model.composeChanged ? (
								<Label title="Compose configuration changed" systemImage="doc.text" />
							) : null}
							{model.serviceChanges.map((change) => (
								<Text key={change} modifiers={[font({ textStyle: 'subheadline' })]}>
									{change}
								</Text>
							))}
							{model.environmentChanged ? (
								<Label title="Environment variables changed" systemImage="key" />
							) : null}
							{model.additionalChanges.map((change) => (
								<Text key={`additional-${change}`}>{change}</Text>
							))}
						</Section>
						{model.composeChanged ? (
							<Section>
								<DisclosureGroup
									label="YAML Diff"
									isExpanded={diffExpanded}
									onIsExpandedChange={setDiffExpanded}
								>
									<Text
										modifiers={[
											font({ textStyle: 'caption' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										This diff may contain sensitive values.
									</Text>
									<ScrollView axes="horizontal">
										<Text
											modifiers={[
												font({ textStyle: 'caption', design: 'monospaced' }),
												textSelection(true)
											]}
										>
											{model.sourceDiff}
										</Text>
									</ScrollView>
								</DisclosureGroup>
							</Section>
						) : null}
						<Section
							footer={<Text>Saving stores your files. Deployment is a separate operation.</Text>}
						>
							<Button label={model.saveTitle} onPress={() => model.save(false)} />
							{model.canDeploy ? (
								<Button label="Save and deploy" onPress={() => model.save(true)} />
							) : null}
						</Section>
					</Form>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
