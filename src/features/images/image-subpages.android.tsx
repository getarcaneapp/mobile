import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import type { ParsedEnvironmentVariable } from '@/core/environment-secret-detector';
import { M3Section, TextButtonRow, ValueRow } from '@/features/containers/android-material';
import { routePayloads } from '@/features/containers/container-routes';
import {
	sortedLabelKeys,
	useEnvironmentVariables
} from '@/features/containers/use-container-subpages';
import type { ImageAttestation } from '@/sdk/models/image/ImageAttestation';
import { colors, systemColors } from '@/theme/colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { MaterialListGroup } from '@/ui/material/list';

import { byteString } from './image-model';
import { imageCache } from './image-routes';
import { useAttestationStatement } from './use-image-tabs';

const Separator = () => (
	<View style={{ height: 0.5, marginLeft: 16, backgroundColor: colors.separator }} />
);

export function ImageAttestationScreen() {
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
		<>
			<Stack.Screen options={{ title: 'Attestation' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section>
					<ValueRow title="Type" value={attestation.predicateType} monospaced />
					{attestation.platform !== undefined ? (
						<ValueRow title="Platform" value={attestation.platform} />
					) : null}
					<ValueRow title="Size" value={byteString(attestation.size)} />
					<ValueRow title="Media Type" value={attestation.mediaType} monospaced />
					<View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}>
						<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>Digest</Text>
						<Text selectable style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label }}>
							{attestation.digest}
						</Text>
					</View>
				</M3Section>
				{subjects.length > 0 ? (
					<M3Section title="Subjects">
						{subjects.map((subject) => (
							<View
								key={subject.name}
								style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}
							>
								<Text
									selectable
									style={{ fontFamily: monoFamily, fontSize: 12, color: colors.label }}
								>
									{subject.name}
								</Text>
								{Object.keys(subject.digest)
									.sort()
									.map((algorithm) => (
										<Text
											key={algorithm}
											numberOfLines={1}
											ellipsizeMode="middle"
											style={{ fontFamily: monoFamily, fontSize: 11, color: colors.secondaryLabel }}
										>
											{`${algorithm}:${subject.digest[algorithm] ?? ''}`}
										</Text>
									))}
							</View>
						))}
					</M3Section>
				) : null}
				<M3Section title="Statement">
					{statement.statementPreview !== undefined ? (
						<>
							<ScrollView horizontal showsHorizontalScrollIndicator={false}>
								<View style={{ padding: 16 }}>
									{statement.statementPreview.chunks.map((chunk, index) => (
										<Text
											key={index}
											selectable
											style={{ fontFamily: monoFamily, fontSize: 11, color: colors.label }}
										>
											{chunk}
										</Text>
									))}
								</View>
							</ScrollView>
							{statement.statementPreview.isTruncated ? (
								<Text
									style={[
										m3Type.bodySmall,
										{ color: colors.secondaryLabel, paddingHorizontal: 16, paddingBottom: 8 }
									]}
								>
									{`First ${statement.statementPreview.shownLines} of ${statement.statementPreview.totalLines} lines`}
								</Text>
							) : null}
							<TextButtonRow title="Copy Statement" onPress={statement.copyStatement} />
						</>
					) : statement.isLoadingStatement ? (
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
							<ActivityIndicator size="small" />
							<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
								Loading statement…
							</Text>
						</View>
					) : statement.statementError !== undefined ? (
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
							<Icon name="exclamationmark.triangle" size={16} color={systemColors.orange} />
							<Text style={[m3Type.bodySmall, { color: systemColors.orange, flex: 1 }]}>
								{statement.statementError}
							</Text>
						</View>
					) : (
						<TextButtonRow title="Load Statement" onPress={statement.loadStatement} />
					)}
				</M3Section>
			</ScrollView>
		</>
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
	if (variable.value === undefined || variable.name === '' || variable.value === '') {
		return (
			<Text selectable style={[m3Type.bodySmall, { color: colors.label, padding: 16 }]}>
				{variable.rawValue}
			</Text>
		);
	}
	const hides = variable.isPotentialSecret && !isRevealed;
	return (
		<View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 5 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				<Text style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}>{variable.name}</Text>
				{variable.isPotentialSecret ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
						<Icon name="lock.fill" size={11} color={systemColors.orange} />
						<Text style={[m3Type.labelSmall, { color: systemColors.orange }]}>
							Potential secret
						</Text>
					</View>
				) : null}
			</View>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<Text
					selectable={!hides}
					accessibilityLabel={hides ? 'Potential secret hidden' : variable.value}
					style={[m3Type.bodyLarge, { flex: 1, color: colors.label }]}
				>
					{hides ? '••••••••••••' : variable.value}
				</Text>
				{variable.isPotentialSecret ? (
					<Pressable
						onPress={() => setIsRevealed((value) => !value)}
						accessibilityRole="button"
						accessibilityLabel={
							isRevealed ? `Hide value for ${variable.name}` : `Reveal value for ${variable.name}`
						}
						style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
					>
						<Icon name={isRevealed ? 'eye.slash' : 'eye'} size={18} color={colors.secondaryLabel} />
					</Pressable>
				) : null}
			</View>
		</View>
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
					headerSearchBarOptions: {
						onChangeText: (event) => setSearchText(event.nativeEvent.text),
						onClose: () => setSearchText('')
					}
				}}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
			>
				<MaterialListGroup>
					{displayedEntries.map((entry, index) => (
						<View key={entry.id}>
							{index > 0 ? <Separator /> : null}
							<VariableRow variable={entry.variable} revealReset={revealReset} />
						</View>
					))}
				</MaterialListGroup>
			</ScrollView>
		</>
	);
}

export function ImageLabelsScreen() {
	const labels = useCachedImageDetails()?.config.labels ?? {};
	return (
		<>
			<Stack.Screen options={{ title: 'Labels' }} />
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingVertical: 12 }}
			>
				<MaterialListGroup>
					{sortedLabelKeys(labels).map((key) => (
						<ValueRow key={key} title={key} value={labels[key] ?? ''} />
					))}
				</MaterialListGroup>
			</ScrollView>
		</>
	);
}
