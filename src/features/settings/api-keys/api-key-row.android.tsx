/** Material rendering of `APIKeyRow` / `APIKeyStatusBadge` (APIKeysView.swift). Standalone. */
import { Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { APIKeyDateText, APIKeyOwnerText, apiKeyIsExpired } from './api-key-models';
import type { APIKeyRowProps } from './api-key-row.types';

export function APIKeyStatusBadge({ isExpired }: { isExpired: boolean }) {
	const tint = isExpired ? systemColors.red : systemColors.green;
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
			<Icon
				name={isExpired ? 'xmark.circle.fill' : 'checkmark.circle.fill'}
				size={16}
				color={tint}
			/>
			<Text style={[m3Type.bodyMedium, { color: tint }]}>{isExpired ? 'Expired' : 'Active'}</Text>
		</View>
	);
}

function CompactMetadata({
	title,
	value,
	systemImage
}: {
	title: string;
	value: string;
	systemImage: string;
}) {
	return (
		<View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
			<Icon
				name={systemImage}
				size={14}
				color={colors.secondaryLabel}
				style={{ width: 16, marginTop: 2 }}
			/>
			<View style={{ gap: 1, flexShrink: 1 }}>
				<Text style={[m3Type.labelSmall, { color: colors.tertiaryLabel }]}>{title}</Text>
				<Text style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}>{value}</Text>
			</View>
		</View>
	);
}

export function APIKeyRow({ apiKey, assignedUser }: APIKeyRowProps) {
	const isExpired = apiKeyIsExpired(apiKey);
	return (
		<View style={{ gap: 10 }} accessible>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				<RowIcon systemImage="key.fill" tint={systemColors.yellow} />
				<View style={{ flex: 1, gap: 3 }}>
					<Text style={[m3Type.bodyLarge, { color: colors.label }]}>{apiKey.name}</Text>
					<Text
						style={[m3Type.bodyMedium, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
					>{`${apiKey.keyPrefix}…`}</Text>
				</View>
				<APIKeyStatusBadge isExpired={isExpired} />
			</View>
			{apiKey.description ? (
				<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
					{apiKey.description}
				</Text>
			) : null}
			<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
				<CompactMetadata
					title="Assigned To"
					value={APIKeyOwnerText.title(assignedUser, apiKey.userId)}
					systemImage="person.fill"
				/>
				<CompactMetadata
					title="Last Used"
					value={APIKeyDateText.lastUsed(apiKey.lastUsedAt)}
					systemImage="clock.fill"
				/>
			</View>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
				<Icon
					name="calendar"
					size={14}
					color={isExpired ? systemColors.red : colors.tertiaryLabel}
				/>
				<Text
					style={[m3Type.bodySmall, { color: isExpired ? systemColors.red : colors.tertiaryLabel }]}
				>
					{APIKeyDateText.expiration(apiKey.expiresAt)}
				</Text>
			</View>
		</View>
	);
}
