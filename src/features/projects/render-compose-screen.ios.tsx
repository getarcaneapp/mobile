import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import { Host } from '@/ui/host';
import {
	Button,
	ContentUnavailableView,
	Form,
	HStack,
	NavigationStack,
	ScrollView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	bold,
	disabled,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	textSelection
} from '@expo/ui/swift-ui/modifiers';

import { FormTextField } from '@/ui/components/form-fields';

import { useRenderCompose } from './use-render-compose';

export function RenderComposeScreen() {
	const toolbarSymbol = useAppAccentToolbarSymbol();
	const model = useRenderCompose();
	const titled = [navigationTitle(model.title), navigationBarTitleDisplayMode('inline')];

	let body;
	if (model.variableOrder.length === 0) {
		body = (
			<ContentUnavailableView
				title="No Variables"
				systemImage="checkmark.seal"
				description="This compose file has no ${VAR} placeholders to resolve."
				modifiers={titled}
			/>
		);
	} else if (model.showPreview) {
		body = (
			<ScrollView modifiers={titled}>
				<Text
					modifiers={[
						font({ textStyle: 'caption', design: 'monospaced' }),
						frame({ maxWidth: Infinity, alignment: 'leading' }),
						padding({ all: 16 }),
						textSelection(true)
					]}
				>
					{model.resolved}
				</Text>
			</ScrollView>
		);
	} else {
		body = (
			<Form modifiers={titled}>
				<Section>
					<Text
						modifiers={[
							font({ textStyle: 'caption' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						Fill values for the placeholders found in this compose file. Empty values fall back to
						the default (if any).
					</Text>
				</Section>
				<Section title="Variables">
					{model.variableOrder.map((key) => {
						const def = model.defaults[key];
						return (
							<VStack
								key={key}
								alignment="leading"
								spacing={4}
								modifiers={[padding({ vertical: 2 })]}
							>
								<HStack>
									<Text
										modifiers={[font({ textStyle: 'subheadline', design: 'monospaced' }), bold()]}
									>
										{key}
									</Text>
									<Spacer />
									{def ? (
										<Text
											modifiers={[
												font({ textStyle: 'caption2' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
												lineLimit(1)
											]}
										>{`default: ${def}`}</Text>
									) : null}
								</HStack>
								<FormTextField
									title="Value"
									placeholder={def ?? 'value'}
									text={model.values[key] ?? ''}
									onChangeText={(text) => model.setValue(key, text)}
									autocapitalization="never"
									autocorrectionDisabled
									monospaced
								/>
							</VStack>
						);
					})}
				</Section>
			</Form>
		);
	}

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					{body}
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Cancel" onPress={model.cancel} modifiers={toolbarSymbol} />
						</ToolbarItem>
						{model.showPreview ? (
							<ToolbarItem placement="topBarTrailing">
								<Button label="Edit" onPress={model.edit} modifiers={toolbarSymbol} />
							</ToolbarItem>
						) : model.variableOrder.length > 0 ? (
							<ToolbarItem placement="topBarTrailing">
								<Button label="Preview" onPress={model.preview} modifiers={toolbarSymbol} />
							</ToolbarItem>
						) : null}
						<ToolbarItem placement="confirmationAction">
							<Button
								label="Use Resolved"
								onPress={model.useResolved}
								modifiers={[disabled(model.variableOrder.length === 0), ...toolbarSymbol]}
							/>
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
