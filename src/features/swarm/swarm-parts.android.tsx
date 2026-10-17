/** Android renderings of the shared swarm pieces (SwarmCommon.swift). Standalone (RN views). */
import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { ArcaneLoadingView } from '@/ui/components/arcane-loading-view';
import { m3 } from '@/ui/components/material-colors';
import { ResourceStatusBadge } from '@/ui/components/resource-status-badge';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';
import { showToast, Toasts } from '@/ui/toast';

import { CenteredMessage } from '@/features/containers/android-material';

import { shortID, swarmBadgeStatus, swarmStateLabel } from './swarm-common';
import type {
	CopyValueRowProps,
	SwarmKeyValueRowsProps,
	SwarmListStateProps,
	SwarmStateBadgeProps
} from './swarm-parts.types';

export function SwarmStateBadge({ state, usesCardStyle = true }: SwarmStateBadgeProps) {
	return (
		<ResourceStatusBadge
			status={swarmBadgeStatus(state)}
			isLive={false}
			usesCardStyle={usesCardStyle}
			label={swarmStateLabel(state)}
		/>
	);
}

export function SwarmListState({
	isLoading,
	isEmpty,
	errorMessage,
	emptyTitle,
	emptySystemImage,
	emptyDescription,
	retry,
	children
}: SwarmListStateProps) {
	if (isLoading && isEmpty) {
		return (
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: colors.systemGroupedBackground
				}}
			>
				<ArcaneLoadingView label="Loading…" />
			</View>
		);
	}
	if (errorMessage !== undefined && isEmpty) {
		return (
			<CenteredMessage
				icon="exclamationmark.triangle"
				title="Couldn't Load"
				message={errorMessage}
				action={{ title: 'Try Again', onPress: retry }}
			/>
		);
	}
	if (isEmpty)
		return (
			<CenteredMessage
				icon={emptySystemImage}
				title={emptyTitle}
				message={emptyDescription ?? ''}
			/>
		);
	return <>{children}</>;
}

export function SwarmKeyValueRows({ pairs }: SwarmKeyValueRowsProps) {
	return (
		<>
			{pairs.map(([key, value], index) => (
				<View
					key={index}
					style={{
						flexDirection: 'row',
						gap: 16,
						minHeight: 48,
						paddingHorizontal: 16,
						paddingVertical: 10,
						alignItems: 'center'
					}}
				>
					<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{key}</Text>
					<Text
						selectable
						style={{
							flex: 1,
							textAlign: 'right',
							fontFamily: monoFamily,
							fontSize: 14,
							color: colors.secondaryLabel
						}}
					>
						{value}
					</Text>
				</View>
			))}
		</>
	);
}

export async function copyToClipboard(value: string) {
	await Clipboard.setStringAsync(value);
	showToast(Toasts.copied());
}

export function CopyValueRow({ title, value }: CopyValueRowProps) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 48,
				paddingHorizontal: 16
			}}
		>
			<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>{title}</Text>
			<Pressable
				onPress={() => void copyToClipboard(value)}
				accessibilityRole="button"
				accessibilityLabel={`Copy ${title}`}
				style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
			>
				<Text style={{ fontFamily: monoFamily, fontSize: 14, color: m3.primary }}>
					{shortID(value)}
				</Text>
				<Icon name="doc.on.doc" size={14} color={m3.primary} />
			</Pressable>
		</View>
	);
}
