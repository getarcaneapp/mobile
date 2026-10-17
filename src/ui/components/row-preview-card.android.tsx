/**
 * Port of `RowPreviewCard` (Android): the same summary as a Material 3 card,
 * for long-press previews / bottom-sheet headers.
 *
 * Standalone (RN view).
 */
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Icon } from '@/ui/Icon';

import { CachedAsyncImage } from './cached-async-image';
import type { RowPreviewCardProps } from './row-preview-card.types';
import { DashboardCard } from './surfaces';
import { m3Type, monoFamily } from './type-scale';

export function RowPreviewCard({
	icon,
	iconColor,
	iconUrl,
	title,
	subtitle,
	badges = [],
	details = []
}: RowPreviewCardProps) {
	return (
		<DashboardCard style={{ width: 320, padding: 20, gap: 16 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
				<CachedAsyncImage
					url={iconUrl}
					size={52}
					fallback={
						<View
							style={{
								width: 52,
								height: 52,
								borderRadius: 26,
								backgroundColor: iconColor,
								alignItems: 'center',
								justifyContent: 'center'
							}}
						>
							<Icon name={icon} size={28} color="#FFFFFF" />
						</View>
					}
				/>
				<View style={{ flex: 1, gap: 4 }}>
					<Text
						numberOfLines={1}
						ellipsizeMode="middle"
						style={[m3Type.titleLarge, { color: colors.label }]}
					>
						{title}
					</Text>
					{subtitle ? (
						<Text numberOfLines={2} style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
							{subtitle}
						</Text>
					) : null}
					{badges.length > 0 ? (
						<View style={{ flexDirection: 'row', gap: 6, paddingTop: 2 }}>
							{badges.map((badge) => (
								<Text
									key={`${badge.text}-${badge.color}`}
									style={[
										m3Type.labelSmall,
										{
											color: '#FFFFFF',
											backgroundColor: badge.color,
											paddingHorizontal: 8,
											paddingVertical: 3,
											borderRadius: 999,
											overflow: 'hidden'
										}
									]}
								>
									{badge.text}
								</Text>
							))}
						</View>
					) : null}
				</View>
			</View>
			{details.length > 0 ? (
				<View style={{ gap: 12 }}>
					{details.map((detail) => (
						<View key={`${detail.label}-${detail.value}`} style={{ gap: 4 }}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
								<Icon name={detail.icon} size={14} color={colors.secondaryLabel} />
								<Text style={[m3Type.labelMedium, { color: colors.secondaryLabel }]}>
									{detail.label}
								</Text>
							</View>
							<Text
								style={[
									detail.monospaced ? { fontFamily: monoFamily, fontSize: 12 } : m3Type.bodyMedium,
									{ color: colors.label }
								]}
							>
								{detail.value}
							</Text>
						</View>
					))}
				</View>
			) : null}
		</DashboardCard>
	);
}
