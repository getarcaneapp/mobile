import { useState } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

import {
	segmentGap,
	segmentWidths,
	severitySegments,
	type SeverityBarProps
} from './severity-bar.types';
import { m3Type } from './type-scale';

export function SeverityBar(props: SeverityBarProps) {
	const { segments, total, summary } = severitySegments(props);
	const [width, setWidth] = useState(0);
	const visible = segments.filter((segment) => segment.count > 0);
	const widths = segmentWidths(
		visible.map((segment) => segment.count),
		width
	);
	return (
		<View accessible accessibilityLabel={summary} style={{ gap: 8 }}>
			<View
				onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
				style={{ height: 8, flexDirection: 'row', gap: total > 0 ? segmentGap : 0 }}
			>
				{total > 0 ? (
					visible.map((segment, index) => (
						<View
							key={segment.label}
							style={{
								width: widths[index] ?? 0,
								height: 8,
								borderRadius: 4,
								backgroundColor: segment.color
							}}
						/>
					))
				) : (
					<View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#8E8E9326' }} />
				)}
			</View>
			<View style={{ flexDirection: 'row', gap: 12 }}>
				{segments.map((segment) => (
					<View key={segment.label} style={{ flex: 1, alignItems: 'center', gap: 1 }}>
						<Text
							style={[
								m3Type.labelMedium,
								{
									fontWeight: '700',
									color: segment.count > 0 ? segment.color : colors.secondaryLabel
								}
							]}
						>
							{String(segment.count)}
						</Text>
						<Text style={[m3Type.labelSmall, { fontWeight: '400', color: colors.secondaryLabel }]}>
							{segment.label}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}
