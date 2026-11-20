import { HStack, Label, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	font,
	foregroundStyle,
	lineLimit
} from '@expo/ui/swift-ui/modifiers';

import { systemColors } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';

import { apiKeyIsExpired, apiKeySummary } from './api-key-models';
import type { APIKeyRowProps } from './api-key-row.types';

export function APIKeyStatusBadge({ isExpired }: { isExpired: boolean }) {
	const tint = isExpired ? systemColors.red : systemColors.green;
	return (
		<Label
			title={isExpired ? 'Expired' : 'Active'}
			systemImage={isExpired ? 'xmark.circle.fill' : 'checkmark.circle.fill'}
			modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(tint)]}
		/>
	);
}

export function APIKeyRow({ apiKey, assignedUser }: APIKeyRowProps) {
	return (
		<HStack spacing={12} modifiers={[accessibilityElement('combine')]}>
			<RowIcon systemImage="key.fill" tint={systemColors.yellow} />
			<VStack alignment="leading" spacing={2}>
				<Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>{apiKey.name}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption', design: 'monospaced' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(1)
					]}
				>
					{`${apiKey.keyPrefix}…`}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(2)
					]}
				>
					{apiKeySummary(apiKey, assignedUser)}
				</Text>
			</VStack>
			<Spacer minLength={8} />
			{apiKeyIsExpired(apiKey) ? <APIKeyStatusBadge isExpired /> : null}
		</HStack>
	);
}
