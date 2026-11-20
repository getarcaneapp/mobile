import { Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { apiKeyIsExpired, apiKeySummary } from './api-key-models';
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

export function APIKeyRow({ apiKey, assignedUser }: APIKeyRowProps) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible>
			<RowIcon systemImage="key.fill" tint={systemColors.yellow} />
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={[m3Type.bodyLarge, { color: colors.label }]} numberOfLines={1}>
					{apiKey.name}
				</Text>
				<Text
					style={[m3Type.bodySmall, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
					numberOfLines={1}
				>{`${apiKey.keyPrefix}…`}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]} numberOfLines={2}>
					{apiKeySummary(apiKey, assignedUser)}
				</Text>
			</View>
			{apiKeyIsExpired(apiKey) ? <APIKeyStatusBadge isExpired /> : null}
		</View>
	);
}
