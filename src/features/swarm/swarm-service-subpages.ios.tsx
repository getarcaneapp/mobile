/**
 * `EnvVarsView` / `LabelsView` (ContainerDetailView.swift) for a swarm
 * service's spec, pushed from Service Detail → Configuration.
 */
import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Label,
	LabeledContent,
	List,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityHidden,
	accessibilityLabel,
	blur,
	buttonStyle,
	font,
	foregroundStyle,
	frame,
	listStyle,
	privacySensitive,
	textSelection
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import type { ParsedEnvironmentVariable } from '@/core/environment-secret-detector';
import { systemColors } from '@/theme/colors';

import {
	sortedLabelKeys,
	useEnvironmentVariables
} from '@/features/containers/use-container-subpages';

import { useServiceLabels, useServiceVars } from './use-swarm-service-subpages';

function VariableRow({
	variable,
	revealReset
}: {
	variable: ParsedEnvironmentVariable;
	revealReset: number;
}) {
	const [isRevealed, setIsRevealed] = useState(false);
	useEffect(() => setIsRevealed(false), [revealReset]);
	const hides = variable.isPotentialSecret && !isRevealed;
	if (variable.value === undefined || variable.name === '' || variable.value === '') {
		return (
			<Text
				modifiers={[
					font({ textStyle: 'caption' }),
					textSelection(true),
					frame({ maxWidth: Infinity, alignment: 'leading' })
				]}
			>
				{variable.rawValue}
			</Text>
		);
	}
	const displayed = hides ? '••••••••••••' : variable.value;
	return (
		<VStack
			alignment="leading"
			spacing={5}
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<HStack spacing={8}>
				<Text
					modifiers={[
						font({ textStyle: 'caption', weight: 'bold' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{variable.name}
				</Text>
				{variable.isPotentialSecret ? (
					<Label
						title="Potential secret"
						systemImage="lock.fill"
						modifiers={[
							font({ textStyle: 'caption2', weight: 'semibold' }),
							foregroundStyle(systemColors.orange),
							accessibilityHidden(true)
						]}
					/>
				) : null}
				<Spacer minLength={0} />
			</HStack>
			<HStack spacing={0}>
				<Text
					modifiers={[
						font({ textStyle: 'body' }),
						blur(hides ? 2.5 : 0),
						textSelection(true),
						privacySensitive(variable.isPotentialSecret),
						accessibilityLabel(hides ? 'Potential secret hidden' : displayed),
						frame({ maxWidth: Infinity, alignment: 'leading' })
					]}
				>
					{displayed}
				</Text>
				{variable.isPotentialSecret ? (
					<Button
						onPress={() => setIsRevealed((value) => !value)}
						modifiers={[
							buttonStyle('borderless'),
							accessibilityLabel(
								isRevealed ? `Hide value for ${variable.name}` : `Reveal value for ${variable.name}`
							)
						]}
					>
						<Image
							systemName={isRevealed ? 'eye.slash' : 'eye'}
							modifiers={[
								font({ textStyle: 'subheadline', weight: 'semibold' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
								frame({ width: 44, height: 44 })
							]}
						/>
					</Button>
				) : null}
			</HStack>
		</VStack>
	);
}

export function SwarmServiceEnvScreen() {
	const vars = useServiceVars();
	const { displayedEntries, setSearchText, revealReset } = useEnvironmentVariables(vars);
	return (
		<>
			<Stack.Screen
				options={{
					title: 'Environment Variables',
					headerLargeTitleEnabled: false,
					headerSearchBarOptions: {
						onChangeText: (event) => setSearchText(event.nativeEvent.text),
						onCancelButtonPress: () => setSearchText('')
					}
				}}
			/>
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					{displayedEntries.map((entry) => (
						<VariableRow key={entry.id} variable={entry.variable} revealReset={revealReset} />
					))}
				</List>
			</Host>
		</>
	);
}

export function SwarmServiceLabelsScreen() {
	const labels = useServiceLabels();
	return (
		<>
			<Stack.Screen options={{ title: 'Labels', headerLargeTitleEnabled: false }} />
			<Host style={{ flex: 1 }}>
				<List modifiers={[listStyle('insetGrouped')]}>
					{sortedLabelKeys(labels).map((key) => (
						<LabeledContent key={key} label={key}>
							<Text modifiers={[textSelection(true)]}>{labels[key] ?? ''}</Text>
						</LabeledContent>
					))}
				</List>
			</Host>
		</>
	);
}
