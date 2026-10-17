import { Host } from '@/ui/host';
import {
	Button,
	HStack,
	Label,
	LabeledContent,
	List,
	NavigationStack,
	ProgressView,
	ScrollView,
	Section,
	Spacer,
	Text,
	Toolbar,
	ToolbarItem,
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
	multilineTextAlignment,
	navigationBarTitleDisplayMode,
	navigationTitle,
	privacySensitive,
	scaleEffect,
	textSelection,
	truncationMode
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import type { ParsedEnvironmentVariable } from '@/core/environment-secret-detector';
import { routePayloads } from '@/features/containers/container-routes';
import {
	sortedLabelKeys,
	useEnvironmentVariables
} from '@/features/containers/use-container-subpages';
import type { ImageAttestation } from '@/sdk/models/image/ImageAttestation';
import { systemColors } from '@/theme/colors';

import { byteString } from './image-model';
import { imageCache } from './image-routes';
import { useAttestationStatement } from './use-image-tabs';

export function ImageAttestationScreen() {
	const router = useRouter();
	const {
		id = '',
		envID = '0',
		token
	} = useLocalSearchParams<{ id?: string; envID?: string; token?: string }>();
	const [attestation] = useState(() => routePayloads.get<ImageAttestation>(token));
	const statement = useAttestationStatement(envID, id, attestation);
	if (!attestation) return null;
	const subjects = attestation.subject ?? [];
	return (
		<Host style={{ flex: 1 }}>
			<NavigationStack>
				<Toolbar>
					<List
						modifiers={[navigationTitle('Attestation'), navigationBarTitleDisplayMode('inline')]}
					>
						<Section>
							<LabeledContent label="Type">
								<Text
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										multilineTextAlignment('trailing'),
										textSelection(true)
									]}
								>
									{attestation.predicateType}
								</Text>
							</LabeledContent>
							{attestation.platform !== undefined ? (
								<LabeledContent label="Platform">
									<Text>{attestation.platform}</Text>
								</LabeledContent>
							) : null}
							<LabeledContent label="Size">
								<Text>{byteString(attestation.size)}</Text>
							</LabeledContent>
							<LabeledContent label="Media Type">
								<Text
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										multilineTextAlignment('trailing'),
										textSelection(true)
									]}
								>
									{attestation.mediaType}
								</Text>
							</LabeledContent>
							<VStack alignment="leading" spacing={2}>
								<Text
									modifiers={[
										font({ textStyle: 'caption' }),
										foregroundStyle({ type: 'hierarchical', style: 'secondary' })
									]}
								>
									Digest
								</Text>
								<Text
									modifiers={[
										font({ textStyle: 'caption', design: 'monospaced' }),
										textSelection(true)
									]}
								>
									{attestation.digest}
								</Text>
							</VStack>
						</Section>
						{subjects.length > 0 ? (
							<Section title="Subjects">
								{subjects.map((subject) => (
									<VStack key={subject.name} alignment="leading" spacing={2}>
										<Text
											modifiers={[
												font({ textStyle: 'caption', design: 'monospaced' }),
												textSelection(true)
											]}
										>
											{subject.name}
										</Text>
										{Object.keys(subject.digest)
											.sort()
											.map((algorithm) => (
												<Text
													key={algorithm}
													modifiers={[
														font({ textStyle: 'caption2', design: 'monospaced' }),
														foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
														truncationMode('middle')
													]}
												>
													{`${algorithm}:${subject.digest[algorithm] ?? ''}`}
												</Text>
											))}
									</VStack>
								))}
							</Section>
						) : null}
						<Section title="Statement">
							{statement.statementJSON !== undefined ? (
								<>
									<ScrollView axes="horizontal" showsIndicators={false}>
										<Text
											modifiers={[
												font({ textStyle: 'caption2', design: 'monospaced' }),
												textSelection(true),
												frame({ maxWidth: Infinity, alignment: 'leading' })
											]}
										>
											{statement.statementJSON}
										</Text>
									</ScrollView>
									<Button onPress={statement.copyStatement}>
										<Label title="Copy Statement" systemImage="doc.on.doc" />
									</Button>
								</>
							) : statement.isLoadingStatement ? (
								<HStack>
									<ProgressView modifiers={[scaleEffect(0.8)]} />
									<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
										Loading statement…
									</Text>
								</HStack>
							) : statement.statementError !== undefined ? (
								<Label
									title={statement.statementError}
									systemImage="exclamationmark.triangle"
									modifiers={[font({ textStyle: 'caption' }), foregroundStyle(systemColors.orange)]}
								/>
							) : (
								<Button label="Load Statement" onPress={statement.loadStatement} />
							)}
						</Section>
					</List>
					<Toolbar.Content>
						<ToolbarItem placement="cancellationAction">
							<Button label="Done" onPress={() => router.back()} />
						</ToolbarItem>
					</Toolbar.Content>
				</Toolbar>
			</NavigationStack>
		</Host>
	);
}

function useCachedImageDetails() {
	const { id = '', envID = '0' } = useLocalSearchParams<{ id?: string; envID?: string }>();
	return imageCache.details(envID, id);
}

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

export function ImageEnvVarsScreen() {
	const details = useCachedImageDetails();
	const { displayedEntries, setSearchText, revealReset } = useEnvironmentVariables(
		details?.config.env ?? []
	);
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

export function ImageLabelsScreen() {
	const labels = useCachedImageDetails()?.config.labels ?? {};
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
