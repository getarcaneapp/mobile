import { HStack, Label, Text, VStack } from '@expo/ui/swift-ui';
import {
	accessibilityElement,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding
} from '@expo/ui/swift-ui/modifiers';

import type { Template } from '@/sdk/models/template/Template';
import { systemColors } from '@/theme/colors';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { RowIcon } from '@/ui/components/row-icon';

export function TemplateRow({ template }: { template: Template }) {
	const tint = template.isRemote ? systemColors.blue : systemColors.indigo;
	const version = template.metadata?.version;
	const tags = template.metadata?.tags ?? [];
	return (
		<HStack
			spacing={12}
			modifiers={[
				frame({ maxWidth: Infinity, alignment: 'leading' }),
				padding({ vertical: 2 }),
				accessibilityElement('combine')
			]}
		>
			<CachedAsyncImageSwiftUI
				url={template.metadata?.iconUrl}
				size={36}
				tiled
				fallback={
					<RowIcon systemImage={template.isRemote ? 'cloud.fill' : 'doc.text.fill'} tint={tint} />
				}
			/>
			<VStack alignment="leading" spacing={4}>
				<Text modifiers={[font({ textStyle: 'headline' })]}>{template.name}</Text>
				<Text
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
						lineLimit(2)
					]}
				>
					{template.description}
				</Text>
				<HStack spacing={6}>
					<Label
						title={template.isRemote ? 'Remote' : 'Local'}
						systemImage={template.isRemote ? 'cloud' : 'internaldrive'}
						modifiers={[font({ textStyle: 'caption2', weight: 'semibold' }), foregroundStyle(tint)]}
					/>
					{version ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption2', design: 'monospaced' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>
							{version}
						</Text>
					) : null}
					{tags.length > 0 ? (
						<Text
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						>{`${tags.length} tag${tags.length === 1 ? '' : 's'}`}</Text>
					) : null}
				</HStack>
			</VStack>
		</HStack>
	);
}
