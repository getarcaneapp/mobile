/** Port of `ContainerInspectView` in its sheet (`NavigationStack` + Done). */
import { Host } from '@/ui/host';
import { UnavailableView } from '@/ui/components/unavailable-view';
import { Image } from '@/ui/components/swiftui-image';
import { useAppAccentToolbarSymbol } from '@/ui/components/swiftui-toolbar';
import {
	Button,
	NavigationStack,
	ScrollView,
	Text,
	Toolbar,
	ToolbarItem,
	VStack,
	useNativeState
} from '@expo/ui/swift-ui';
import {
	accessibilityLabel,
	disabled,
	fixedSize,
	font,
	frame,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	refreshable,
	searchable,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingViewSwiftUI } from '@/ui/components/arcane-loading-view-swiftui';
import { ToastHost } from '@/ui/toast';

import { useContainerInspect } from './use-container-inspect';

export function ContainerInspectScreen() {
	const toolbarAccent = useAppAccentToolbarSymbol();
	const router = useRouter();
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	const model = useContainerInspect(envID, id);
	const query = useNativeState('');
	const titleModifiers = [
		navigationTitle('Inspect'),
		navigationBarTitleDisplayMode('inline' as const)
	];
	const search = searchable(query, { prompt: 'Filter lines', onChange: model.setSearchText });

	let body;
	if (model.isLoading && model.rawJSON === '') {
		body = (
			<VStack
				modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), ...titleModifiers, search]}
			>
				<ArcaneLoadingViewSwiftUI label="Loading inspect…" />
			</VStack>
		);
	} else if (model.errorMessage !== undefined && model.rawJSON === '') {
		body = (
			<UnavailableView
				title="Couldn't Load Inspect"
				systemImage="exclamationmark.triangle"
				description={model.errorMessage}
				actions={[{ title: 'Retry', onPress: () => void model.load() }]}
				modifiers={[...titleModifiers, search]}
			/>
		);
	} else {
		body = (
			<ScrollView modifiers={[...titleModifiers, search, refreshable(model.load)]}>
				<Text
					modifiers={[
						font({ textStyle: 'body', design: 'monospaced' }),
						textSelection(true),
						frame({ maxWidth: Infinity, alignment: 'leading' }),
						fixedSize({ horizontal: false, vertical: true }),
						padding({ all: 16 })
					]}
				>
					{model.displayedJSON}
				</Text>
			</ScrollView>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						{body}
						<Toolbar.Content>
							<ToolbarItem placement="topBarLeading">
								<Button label="Done" onPress={() => router.back()} modifiers={toolbarAccent} />
							</ToolbarItem>
							<ToolbarItem placement="topBarTrailing">
								<Button
									onPress={() => void model.copy()}
									modifiers={[
										...toolbarAccent,
										disabled(model.rawJSON === ''),
										accessibilityLabel('Copy')
									]}
								>
									<Image systemName="doc.on.doc" />
								</Button>
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
