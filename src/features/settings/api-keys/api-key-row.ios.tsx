import { HStack, Label, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	font,
	foregroundStyle,
	frame
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { systemColors } from '@/theme/colors';
import { RowIcon } from '@/ui/components/row-icon';

import { APIKeyDateText, APIKeyOwnerText, apiKeyIsExpired } from './api-key-models';
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

function APIKeyCompactMetadata({
	title,
	value,
	systemImage
}: {
	title: string;
	value: string;
	systemImage: string;
}) {
	return (
		<HStack
			alignment="top"
			spacing={7}
			modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
		>
			<Image
				systemName={systemImage as SFSymbol}
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
					frame({ width: 16 })
				]}
			/>
			<VStack alignment="leading" spacing={1}>
				<Text
					modifiers={[
						font({ textStyle: 'caption2' }),
						foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
					]}
				>
					{title}
				</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption', weight: 'medium' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{value}
				</Text>
			</VStack>
			<Spacer minLength={0} />
		</HStack>
	);
}

export function APIKeyRow({ apiKey, assignedUser }: APIKeyRowProps) {
	const isExpired = apiKeyIsExpired(apiKey);
	return (
		<VStack alignment="leading" spacing={10} modifiers={[accessibilityElement('combine')]}>
			<HStack spacing={12}>
				<RowIcon systemImage="key.fill" tint={systemColors.yellow} />
				<VStack alignment="leading" spacing={3}>
					<Text modifiers={[font({ textStyle: 'body' })]}>{apiKey.name}</Text>
					<Text
						modifiers={[
							font({ textStyle: 'subheadline', design: 'monospaced' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' })
						]}
					>
						{`${apiKey.keyPrefix}…`}
					</Text>
				</VStack>
				<Spacer minLength={8} />
				<APIKeyStatusBadge isExpired={isExpired} />
			</HStack>
			{apiKey.description ? (
				<Text
					modifiers={[
						font({ textStyle: 'subheadline' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' })
					]}
				>
					{apiKey.description}
				</Text>
			) : null}
			<HStack alignment="top" spacing={12}>
				<APIKeyCompactMetadata
					title="Assigned To"
					value={APIKeyOwnerText.title(assignedUser, apiKey.userId)}
					systemImage="person.fill"
				/>
				<APIKeyCompactMetadata
					title="Last Used"
					value={APIKeyDateText.lastUsed(apiKey.lastUsedAt)}
					systemImage="clock.fill"
				/>
			</HStack>
			<HStack
				spacing={5}
				modifiers={[
					font({ textStyle: 'caption' }),
					foregroundStyle(
						isExpired ? systemColors.red : { type: 'hierarchical', style: 'tertiary' }
					)
				]}
			>
				<Image systemName="calendar" modifiers={[accessibilityHidden(true)]} />
				<Text>{APIKeyDateText.expiration(apiKey.expiresAt)}</Text>
			</HStack>
		</VStack>
	);
}
