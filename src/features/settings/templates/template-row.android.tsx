import { Text, View } from 'react-native';

import type { Template } from '@/sdk/models/template/Template';
import { colors, systemColors } from '@/theme/colors';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

const rowStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 16,
	flex: 1,
	paddingVertical: 2
};
const bodyStyle = { flex: 1, gap: 4 };
const metaStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 };

export function TemplateRow({ template }: { template: Template }) {
	const tint = template.isRemote ? systemColors.blue : systemColors.indigo;
	const version = template.metadata?.version;
	const tags = template.metadata?.tags ?? [];
	return (
		<View accessible style={rowStyle}>
			<CachedAsyncImage
				url={template.metadata?.iconUrl}
				size={36}
				tiled
				fallback={
					<RowIcon systemImage={template.isRemote ? 'cloud.fill' : 'doc.text.fill'} tint={tint} />
				}
			/>
			<View style={bodyStyle}>
				<Text style={[m3Type.titleMedium, { color: colors.label }]}>{template.name}</Text>
				<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]} numberOfLines={2}>
					{template.description}
				</Text>
				<View style={metaStyle}>
					<Icon name={template.isRemote ? 'cloud' : 'internaldrive'} size={12} color={tint} />
					<Text style={[m3Type.labelSmall, { color: tint }]}>
						{template.isRemote ? 'Remote' : 'Local'}
					</Text>
					{version ? (
						<Text
							style={[m3Type.labelSmall, { color: colors.secondaryLabel, fontFamily: monoFamily }]}
						>
							{version}
						</Text>
					) : null}
					{tags.length > 0 ? (
						<Text
							style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}
						>{`${tags.length} tag${tags.length === 1 ? '' : 's'}`}</Text>
					) : null}
				</View>
			</View>
		</View>
	);
}
