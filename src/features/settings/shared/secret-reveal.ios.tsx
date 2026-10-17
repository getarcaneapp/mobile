import { Host } from '@/ui/host';
import {
	Button,
	Label,
	NavigationStack,
	ScrollView,
	Text,
	Toolbar,
	ToolbarItem,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	background,
	buttonStyle,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	padding,
	shapes,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import * as Clipboard from 'expo-clipboard';
import { View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { glassEffectCompat, isIOS26 } from '@/ui/components/swiftui-surfaces';
import { showToast, ToastHost, Toasts } from '@/ui/toast';

import type { SecretRevealProps } from './secret-reveal.types';

export function SecretRevealScreen(props: SecretRevealProps) {
	const { secret, secretCaption, fullWidthSecret = false, warning } = props;
	const copy = () => {
		void Clipboard.setStringAsync(secret);
		showToast(Toasts.copied(props.copiedToast));
	};
	const secretText = (
		<Text
			modifiers={[
				font({ textStyle: 'caption', design: 'monospaced' }),
				textSelection(true),
				fixedSize({ horizontal: false, vertical: true })
			]}
		>
			{secret}
		</Text>
	);
	const boxModifiers = [
		padding({ all: 16 }),
		...(fullWidthSecret ? [frame({ maxWidth: Infinity, alignment: 'leading' as const })] : []),
		glassEffectCompat({ shape: 'roundedRectangle', cornerRadius: Radius.nested }),
		padding({ horizontal: 24 })
	];
	return (
		<View style={{ flex: 1 }}>
			<Host style={{ flex: 1 }}>
				<NavigationStack>
					<Toolbar>
						<ScrollView
							modifiers={[
								navigationTitle(props.navigationTitle),
								navigationBarTitleDisplayMode('inline')
							]}
						>
							<VStack spacing={24} modifiers={[padding({ top: 32, bottom: 24 })]}>
								<Image
									systemName={props.systemImage as SFSymbol}
									modifiers={[
										font({ size: 48 }),
										foregroundStyle(props.iconColor),
										padding({ all: 24 }),
										glassEffectCompat({ shape: 'circle' })
									]}
								/>
								<Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>
									{props.heading}
								</Text>
								<Text
									modifiers={[
										multilineTextAlignment('center'),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
										padding({ horizontal: 32 })
									]}
								>
									{props.message}
								</Text>
								{secretCaption !== undefined ? (
									<VStack alignment="leading" spacing={4} modifiers={boxModifiers}>
										<Text
											modifiers={[
												font({ textStyle: 'caption' }),
												foregroundStyle({ type: 'hierarchical', style: 'secondary' })
											]}
										>
											{secretCaption}
										</Text>
										{secretText}
									</VStack>
								) : (
									<VStack modifiers={boxModifiers}>{secretText}</VStack>
								)}
								{warning ? (
									<Label
										title={warning}
										systemImage="exclamationmark.triangle.fill"
										modifiers={[
											font({ textStyle: 'callout' }),
											foregroundStyle(systemColors.orange),
											fixedSize({ horizontal: false, vertical: true }),
											padding({ all: 14 }),
											frame({ maxWidth: Infinity, alignment: 'leading' }),
											background(
												withOpacity(systemColors.orange, 0.12),
												shapes.roundedRectangle({ cornerRadius: Radius.nested })
											),
											padding({ horizontal: 24 })
										]}
									/>
								) : null}
								<Button
									onPress={copy}
									modifiers={[
										buttonStyle(isIOS26 ? 'glassProminent' : 'borderedProminent'),
										padding({ horizontal: 24 })
									]}
								>
									<Label
										title="Copy to Clipboard"
										systemImage="doc.on.clipboard"
										modifiers={[frame({ maxWidth: Infinity }), padding()]}
									/>
								</Button>
							</VStack>
						</ScrollView>
						<Toolbar.Content>
							<ToolbarItem placement="confirmationAction">
								<Button label="Done" onPress={props.onDone} />
							</ToolbarItem>
						</Toolbar.Content>
					</Toolbar>
				</NavigationStack>
			</Host>
			<ToastHost reservesTabBarSpace={false} />
		</View>
	);
}
