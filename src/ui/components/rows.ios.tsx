/**
 * Ports of `RunEndpointButton` (RunEndpointButton.swift) and
 * `DynamicNavigationRow` (DynamicNavigationRow.swift).
 *
 * SwiftUI-tree.
 */
import { Button, HStack, Label, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import { buttonStyle, disabled, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { DisclosureChevron } from '@/ui/settings-row';

import {
	defaultFormatError,
	type DynamicNavigationRowProps,
	type RunEndpointButtonProps
} from './rows.types';
import { isIOS26 } from './swiftui-surfaces';
import { symbolRenderingMode } from '../../../modules/arcane-swiftui-extras';

/** Runs a POST endpoint; shows "Running..." while in flight and the outcome underneath. */
export function RunEndpointButton({
	title,
	systemImage,
	run,
	destructive = false,
	formatError = defaultFormatError
}: RunEndpointButtonProps) {
	const [isRunning, setIsRunning] = useState(false);
	const [message, setMessage] = useState<string>();

	const onPress = async () => {
		setIsRunning(true);
		try {
			await run();
			setMessage('Completed');
		} catch (error) {
			setMessage(formatError(error));
		} finally {
			setIsRunning(false);
		}
	};

	return (
		<>
			<Button
				role={destructive ? 'destructive' : undefined}
				onPress={() => void onPress()}
				modifiers={[
					disabled(isRunning),
					buttonStyle(isIOS26 ? 'glassProminent' : 'borderedProminent')
				]}
			>
				<Label title={isRunning ? 'Running...' : title} systemImage={systemImage as SFSymbol} />
			</Button>
			{message ? (
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{message}
				</Text>
			) : null}
		</>
	);
}

/** A row that pushes a destination: title + secondary subtitle with a hierarchical icon. */
export function DynamicNavigationRow({
	title,
	subtitle,
	systemImage,
	onPress
}: DynamicNavigationRowProps) {
	return (
		<Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
			<HStack>
				<Label
					icon={
						<Image
							systemName={systemImage as SFSymbol}
							modifiers={[
								symbolRenderingMode('hierarchical'),
								foregroundStyle({ type: 'hierarchical', style: 'primary' })
							]}
						/>
					}
				>
					<VStack alignment="leading" spacing={2}>
						<Text>{title}</Text>
						<Text
							modifiers={[
								font({ textStyle: 'subheadline' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{subtitle}
						</Text>
					</VStack>
				</Label>
				<Spacer />
				<DisclosureChevron />
			</HStack>
		</Button>
	);
}
