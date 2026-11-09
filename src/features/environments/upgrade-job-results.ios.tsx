import { ScrollView, Text } from '@expo/ui/swift-ui';
import {
	background,
	defaultScrollAnchor,
	defaultScrollAnchorForRole,
	font,
	foregroundStyle,
	frame,
	padding,
	shapes,
	textSelection
} from '@expo/ui/swift-ui/modifiers';

import { systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';

import { resultLogs } from './upgrade-job-follow';
import type { UpgradeLogsProps } from './upgrade-job-results.types';

const secondary = { type: 'hierarchical', style: 'secondary' } as const;

export function UpgradeLogs({ logs, maxHeight = 220 }: UpgradeLogsProps) {
	const text = resultLogs(logs);
	if (!text) {
		return (
			<Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(secondary)]}>
				No logs yet
			</Text>
		);
	}
	return (
		<ScrollView
			modifiers={[
				frame({ maxWidth: Infinity, maxHeight }),
				defaultScrollAnchor('bottom'),
				defaultScrollAnchorForRole('bottom', 'sizeChanges'),
				background(
					withOpacity(systemColors.gray, 0.12),
					shapes.roundedRectangle({ cornerRadius: Radius.nested })
				)
			]}
		>
			<Text
				modifiers={[
					font({ textStyle: 'caption2', design: 'monospaced' }),
					textSelection(true),
					frame({ maxWidth: Infinity, alignment: 'leading' }),
					padding({ all: 12 })
				]}
			>
				{text}
			</Text>
		</ScrollView>
	);
}
