/**
 * Android (Material 3) rendering of `DashboardPinnedSection`: pinned
 * containers and projects with a start/stop quick action per row.
 *
 * Standalone (RN view).
 */
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { ContainerSummary } from '@/sdk/models/container/ContainerSummary';
import type { ProjectDetails } from '@/sdk/models/project/Project';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { GlassCard } from '@/ui/components/surfaces';
import { m3Type } from '@/ui/components/type-scale';

import { PinnedItem, useDashboardPinned, type DashboardPinnedItem } from '../use-dashboard-pinned';
import { DashboardRowChevron, DashboardSectionTitle } from './dashboard-parts';

export function DashboardPinnedSection({
	refreshToken,
	onOpenContainer,
	onOpenProject
}: {
	refreshToken: number;
	onOpenContainer: (container: ContainerSummary) => void;
	onOpenProject: (project: ProjectDetails) => void;
}) {
	const { items, isLoading, runningID, runAction } = useDashboardPinned(refreshToken);
	const open = (item: DashboardPinnedItem) =>
		item.kind === 'container' ? onOpenContainer(item.container) : onOpenProject(item.project);

	return (
		<View style={{ gap: 12 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center' }}>
				<DashboardSectionTitle title="Pinned" />
				<View style={{ flex: 1 }} />
				{isLoading && items.length > 0 ? (
					<ActivityIndicator size="small" color={m3.primary} />
				) : null}
			</View>
			<GlassCard style={{ overflow: 'hidden' }}>
				{items.length === 0 ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
						{isLoading ? <ActivityIndicator size="small" color={m3.primary} /> : null}
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							{isLoading
								? 'Loading pinned items…'
								: 'Pinned items are unavailable in this environment.'}
						</Text>
					</View>
				) : (
					items.map((item, index) => {
						const id = PinnedItem.id(item);
						const running = PinnedItem.isRunning(item);
						return (
							<View key={id}>
								<View
									style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 }}
								>
									<Pressable
										onPress={() => open(item)}
										android_ripple={{ color: colors.separator as string }}
										accessibilityRole="button"
										accessibilityLabel={`${PinnedItem.title(item)}: ${PinnedItem.status(item)}`}
										style={{
											flex: 1,
											flexDirection: 'row',
											alignItems: 'center',
											gap: 12,
											paddingLeft: 16,
											paddingVertical: 10
										}}
									>
										<View>
											<RowIcon
												systemImage={PinnedItem.icon(item)}
												tint={PinnedItem.tint(item)}
												size={30}
											/>
											<View
												style={{
													position: 'absolute',
													right: -2,
													bottom: -2,
													width: 9,
													height: 9,
													borderRadius: 4.5,
													borderWidth: 1.5,
													borderColor: colors.secondarySystemGroupedBackground,
													backgroundColor: running
														? systemColors.green
														: withOpacity('#8E8E93', 0.5)
												}}
											/>
										</View>
										<View style={{ flex: 1, gap: 3 }}>
											<Text numberOfLines={1} style={[m3Type.titleSmall, { color: colors.label }]}>
												{PinnedItem.title(item)}
											</Text>
											<Text
												numberOfLines={1}
												style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}
											>
												{PinnedItem.status(item)}
											</Text>
										</View>
										<DashboardRowChevron />
									</Pressable>
									<Pressable
										onPress={() => void runAction(item)}
										disabled={runningID !== undefined}
										accessibilityRole="button"
										accessibilityLabel={PinnedItem.actionTitle(item)}
										android_ripple={{
											color: colors.separator as string,
											borderless: true,
											radius: 20
										}}
										style={{
											width: 40,
											height: 40,
											borderRadius: 20,
											alignItems: 'center',
											justifyContent: 'center',
											backgroundColor: m3.surfaceContainerHighest
										}}
									>
										{runningID === id ? (
											<ActivityIndicator size="small" color={m3.primary} />
										) : (
											<Icon
												name={PinnedItem.actionSystemImage(item)}
												size={18}
												color={PinnedItem.actionTint(item)}
											/>
										)}
									</Pressable>
								</View>
								{index < items.length - 1 ? (
									<View style={{ height: 1, marginLeft: 58, backgroundColor: colors.separator }} />
								) : null}
							</View>
						);
					})
				)}
			</GlassCard>
		</View>
	);
}
