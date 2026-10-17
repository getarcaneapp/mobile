/**
 * Port of `ProjectFileBrowserRow` (ProjectFilesWorkspaceView.swift).
 *
 * SwiftUI-tree.
 */
import { HStack, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	contentShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	padding,
	scaleEffect,
	shapes
} from '@expo/ui/swift-ui/modifiers';

import { useAccentColor } from '@/theme/accent';

export type ProjectFileBrowserRowProps = {
	name: string;
	detail?: string;
	systemImage: string;
	isDirectory: boolean;
	isProtected?: boolean;
	hasChanges?: boolean;
	depth?: number;
	isLoading?: boolean;
	showsDisclosure?: boolean;
};

export function ProjectFileBrowserRow({
	name,
	detail,
	systemImage,
	isDirectory,
	isProtected = false,
	hasChanges = false,
	depth = 0,
	isLoading = false,
	showsDisclosure = true
}: ProjectFileBrowserRowProps) {
	const accent = useAccentColor();
	return (
		<HStack
			spacing={10}
			modifiers={[padding({ leading: depth * 16 }), contentShape(shapes.rectangle())]}
		>
			<Image
				systemName={systemImage as never}
				modifiers={[foregroundStyle(isDirectory ? accent : 'secondary'), frame({ width: 22 })]}
			/>

			<VStack alignment="leading" spacing={2}>
				<HStack spacing={5}>
					<Text modifiers={[font({ textStyle: 'body' }), lineLimit(1)]}>{name}</Text>
					{isProtected ? (
						<Image
							systemName="lock.fill"
							modifiers={[
								font({ textStyle: 'caption2' }),
								foregroundStyle({ type: 'hierarchical', style: 'secondary' })
							]}
						/>
					) : null}
					{hasChanges ? (
						<Image
							systemName="circle.fill"
							modifiers={[font({ size: 7 }), foregroundStyle('#FF9500')]}
						/>
					) : null}
				</HStack>
				{detail ? (
					<Text
						modifiers={[
							font({ textStyle: 'caption2' }),
							foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
							lineLimit(1)
						]}
					>
						{detail}
					</Text>
				) : null}
			</VStack>

			<Spacer />

			{isLoading ? (
				<ProgressView modifiers={[scaleEffect(0.75)]} />
			) : showsDisclosure ? (
				<Image
					systemName="chevron.right"
					modifiers={[
						font({ textStyle: 'caption' }),
						foregroundStyle({ type: 'hierarchical', style: 'tertiary' })
					]}
				/>
			) : null}
		</HStack>
	);
}
