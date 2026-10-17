/**
 * Ports of `ProjectRow` and `ProjectTagChips` (ProjectsView.swift).
 *
 * SwiftUI-tree.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityElement,
	accessibilityHidden,
	accessibilityLabel,
	font,
	foregroundStyle,
	lineLimit
} from '@expo/ui/swift-ui/modifiers';

import type { ProjectDetails } from '@/sdk/models/project/Project';
import type { ProjectTag } from '@/sdk/models/project/ProjectTag';
import { systemColors } from '@/theme/colors';
import { useIsDark } from '@/ui/components/accessibility';
import { CachedAsyncImageSwiftUI } from '@/ui/components/cached-async-image-swiftui';
import { EnvironmentLabel } from '@/ui/components/environment-label';
import { StatusIcon } from '@/ui/components/resource-status-badge';
import { RowIcon } from '@/ui/components/row-icon';

import {
	projectDisplayName,
	projectRowAccessibility,
	projectTagDisplayColor,
	projectThemedIconUrl
} from './project-model';

const visibleCount = 3;

/** Compact tag list for project rows. */
export function ProjectTagChips({ tags }: { tags: ProjectTag[] }) {
	return (
		<HStack
			spacing={8}
			modifiers={[
				font({ textStyle: 'caption2' }),
				lineLimit(1),
				accessibilityElement('combine'),
				accessibilityLabel(`Tags: ${tags.map((t) => t.name).join(', ')}`)
			]}
		>
			{tags.slice(0, visibleCount).map((tag) => (
				<HStack key={tag.name} spacing={3}>
					<Image
						systemName="tag.fill"
						modifiers={[foregroundStyle(projectTagDisplayColor(tag.color))]}
					/>
					<Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
						{tag.name}
					</Text>
				</HStack>
			))}
			{tags.length > visibleCount ? (
				<Text
					modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
				>{`+${tags.length - visibleCount}`}</Text>
			) : null}
		</HStack>
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
		<HStack
			spacing={12}
			modifiers={[
				accessibilityElement('combine'),
				accessibilityLabel(projectRowAccessibility(project, isPinned, environmentName))
			]}
		>
			<VStack modifiers={[accessibilityHidden(true)]}>
				<CachedAsyncImageSwiftUI
					url={projectThemedIconUrl(project, isDark)}
					size={36}
					tiled
					fallback={<RowIcon systemImage="folder.fill" tint={systemColors.indigo} />}
				/>
			</VStack>

			<VStack alignment="leading" spacing={3}>
				<HStack spacing={4}>
					<Text modifiers={[font({ textStyle: 'body' })]}>{projectDisplayName(project)}</Text>
					{isPinned ? (
						<Image
							systemName="pin.fill"
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle(systemColors.yellow),
								accessibilityHidden(true)
							]}
						/>
					) : null}
				</HStack>
				<EnvironmentLabel name={environmentName} color={environmentColor} />
				{tags.length > 0 ? <ProjectTagChips tags={tags} /> : null}
			</VStack>

			<Spacer />

			<StatusIcon status={project.status} />
		</HStack>
	);
}
