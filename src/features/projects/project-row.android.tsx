import { Text, View } from 'react-native';

import type { ProjectDetails } from '@/sdk/models/project/Project';
import type { ProjectTag } from '@/sdk/models/project/ProjectTag';
import { colors, systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { CachedAsyncImage } from '@/ui/components/cached-async-image';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	projectDisplayName,
	projectRowAccessibility,
	projectTagDisplayColor,
	projectThemedIconUrl
} from './project-model';

const visibleCount = 3;

const chipsStyle = {
	flexDirection: 'row' as const,
	alignItems: 'center' as const,
	gap: 8,
	overflow: 'hidden' as const
};
const chipStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 };
const containerStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 };
const bodyStyle = { flex: 1, gap: 3 };
const titleLineStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 };

export function ProjectTagChips({ tags }: { tags: ProjectTag[] }) {
	return (
		<View
			accessible
			accessibilityLabel={`Tags: ${tags.map((t) => t.name).join(', ')}`}
			style={chipsStyle}
		>
			{tags.slice(0, visibleCount).map((tag) => (
				<View key={tag.name} style={chipStyle}>
					<Icon name="tag.fill" size={11} color={projectTagDisplayColor(tag.color)} />
					<Text numberOfLines={1} style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
						{tag.name}
					</Text>
				</View>
			))}
			{tags.length > visibleCount ? (
				<Text
					style={{ fontSize: 11, color: colors.secondaryLabel }}
				>{`+${tags.length - visibleCount}`}</Text>
			) : null}
		</View>
	);
}

export function ProjectRow({
	project,
	isPinned = false,
	environmentName,
	environmentColor
}: {
	project: ProjectDetails;
	isPinned?: boolean;
	environmentName?: string;
	environmentColor?: string;
}) {
	const isDark = useIsDark();
	const tags = project.tags ?? [];
	return (
		<View
			accessible
			accessibilityLabel={projectRowAccessibility(project, isPinned, environmentName)}
			style={containerStyle}
		>
			<View importantForAccessibility="no-hide-descendants">
				<CachedAsyncImage
					url={projectThemedIconUrl(project, isDark)}
					size={36}
					tiled
					fallback={<RowIcon systemImage="folder.fill" tint={systemColors.indigo} />}
				/>
			</View>
			<View style={bodyStyle}>
				<View style={titleLineStyle}>
					<Text style={[m3Type.bodyLarge, { color: colors.label, flexShrink: 1 }]}>
						{projectDisplayName(project)}
					</Text>
					{isPinned ? <Icon name="pin.fill" size={12} color={systemColors.yellow} /> : null}
				</View>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
				{tags.length > 0 ? <ProjectTagChips tags={tags} /> : null}
			</View>
			<StatusIcon status={project.status} />
		</View>
	);
}
