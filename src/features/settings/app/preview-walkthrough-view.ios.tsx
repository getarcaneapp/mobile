import { Host } from '@/ui/host';
import {
	Button,
	Circle,
	HStack,
	NavigationStack,
	ScrollView,
	TabView,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	background,
	buttonStyle,
	controlSize,
	font,
	foregroundStyle,
	frame,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	padding,
	shapes,
	strokeBorder,
	tabViewStyle
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { useAccentColor } from '@/theme/accent';
import { colors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';

import { usePreviewWalkthrough, type WalkthroughContent } from './preview-walkthrough';

export type PreviewWalkthroughViewProps = {
	content: WalkthroughContent;
	isEnabled: boolean;
	enable: () => void;
	illustration: (index: number) => ReactNode;
};

function IllustrationCard({ children }: { children: ReactNode }) {
	return (
		<VStack
			alignment="leading"
			spacing={16}
			modifiers={[
				font({ textStyle: 'title3' }),
				padding({ all: 24 }),
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				background(
					colors.secondarySystemGroupedBackground,
					shapes.roundedRectangle({ cornerRadius: Radius.hero, roundedCornerStyle: 'continuous' })
				),
				strokeBorder({
					content: { type: 'hierarchical', style: 'quaternary' },
					shape: 'roundedRectangle',
					cornerRadius: Radius.hero
				}),
				accessibilityHidden(true)
			]}
		>
			{children}
		</VStack>
	);
}

export function PreviewWalkthroughView({
	content,
	isEnabled,
	enable,
	illustration
}: PreviewWalkthroughViewProps) {
	const accent = useAccentColor();
	const model = usePreviewWalkthrough(content, enable);
	const { pages, footnote } = content;

	const pageView = (index: number) => {
		const page = pages[index];
		if (!page) return null;
		return (
			<ScrollView>
				<VStack spacing={24} modifiers={[padding({ all: 24 })]}>
					<IllustrationCard>{illustration(index)}</IllustrationCard>
					<VStack
						spacing={12}
						modifiers={[multilineTextAlignment('center'), frame({ maxWidth: Infinity })]}
					>
						<Text
							modifiers={[
								font({ textStyle: 'caption', weight: 'semibold' }),
								foregroundStyle(accent),
								padding({ horizontal: 10, vertical: 5 }),
								background(withOpacity(accent, 0.12), shapes.capsule())
							]}
						>
							Preview
						</Text>
						<Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>
							{page.title}
						</Text>
						<Text
							modifiers={[
								font({ textStyle: 'body' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{page.message}
						</Text>
					</VStack>
					{index === model.lastPage ? (
						<>
							<Text
								modifiers={[
									font({ textStyle: 'footnote' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
									multilineTextAlignment('center')
								]}
							>
								{footnote}
							</Text>
							{!isEnabled ? (
								<Button
									onPress={model.enableAndFinish}
									modifiers={[buttonStyle('borderedProminent'), controlSize('large')]}
								>
									<Text
										modifiers={[
											font({ textStyle: 'headline' }),
											frame({ maxWidth: Infinity }),
											padding({ vertical: 8 })
										]}
									>
										Enable Preview
									</Text>
								</Button>
							) : null}
						</>
					) : null}
				</VStack>
			</ScrollView>
		);
	};

	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar modifiers={[navigationBarTitleDisplayMode('inline')]}>
					<VStack spacing={0}>
						<TabView
							selection={String(model.page)}
							onSelectionChange={(selection) => model.setPage(Number(selection))}
							modifiers={[tabViewStyle({ type: 'page', indexDisplayMode: 'never' })]}
						>
							{pages.map((page, index) => (
								<TabView.Tab key={page.title} value={String(index)}>
									{pageView(index)}
								</TabView.Tab>
							))}
						</TabView>
						<HStack
							spacing={8}
							modifiers={[
								accessibilityElement('ignore'),
								accessibilityLabel(`Page ${model.page + 1} of ${pages.length}`),
								frame({ maxWidth: Infinity }),
								padding({ horizontal: 24, vertical: 16 }),
								background(colors.systemBackground)
							]}
						>
							{pages.map((page, index) => (
								<Circle
									key={page.title}
									modifiers={[
										foregroundStyle(index === model.page ? accent : withOpacity('#8E8E93', 0.25)),
										frame({ width: 7, height: 7 })
									]}
								/>
							))}
						</HStack>
					</VStack>
					<Toolbar.Content>
						<ToolbarItem placement="confirmationAction">
							<Button label="Done" onPress={model.finish} modifiers={[foregroundStyle(accent)]} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}
