/** Android rendering of `APIKeyDetailView` (APIKeyDetailView.swift). */
import { Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors, systemColors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { M3Section, ValueRow } from '../shared/android-material';
import { AndroidToolbar } from '../shared/android-toolbar';
import { APIKeyDateText, APIKeyOwnerText } from './api-key-models';
import { APIKeyStatusBadge } from './api-key-row';
import { useAPIKeyDetail } from './use-api-key-detail';

function Notice({ icon, iconColor, text }: { icon: string; iconColor: string; text: string }) {
	return (
		<View style={{ flexDirection: 'row', gap: 12, padding: 16, alignItems: 'flex-start' }}>
			<Icon name={icon} size={20} color={iconColor} />
			<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel, flex: 1 }]}>{text}</Text>
		</View>
	);
}

export function APIKeyDetailScreen() {
	const model = useAPIKeyDetail();
	const { apiKey } = model;
	if (!apiKey) return <Stack.Screen options={{ title: 'API Key' }} />;

	return (
		<>
			<Stack.Screen options={{ title: 'API Key' }} />
			{model.actionItems.length > 0 ? (
				<AndroidToolbar
					items={[
						{
							kind: 'menu',
							id: 'actions',
							icon: 'ellipsis.circle',
							label: 'API key actions',
							items: model.actionItems.map((item) => ({
								id: item.id,
								title: item.title,
								destructive: item.role === 'destructive',
								disabled: model.runningActionID !== undefined,
								onPress: () => model.requestAction(item)
							}))
						}
					]}
				/>
			) : null}
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 48 }}
			>
				<M3Section>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
						<View style={{ width: 48, alignItems: 'center' }}>
							<Icon name="key.fill" size={34} color={systemColors.yellow} />
						</View>
						<View style={{ flex: 1, gap: 5 }}>
							<Text style={[m3Type.titleMedium, { color: colors.label }]}>{apiKey.name}</Text>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
								<APIKeyStatusBadge isExpired={model.isExpired} />
								<Text style={[m3Type.labelSmall, { color: colors.secondaryLabel }]}>
									{model.kindLabel}
								</Text>
							</View>
						</View>
					</View>
				</M3Section>
				<M3Section title="Key">
					<Pressable
						onPress={model.copyPrefix}
						accessibilityRole="button"
						accessibilityLabel={`Key prefix ${apiKey.keyPrefix}, copy`}
						android_ripple={{ color: colors.separator as string }}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 16,
							minHeight: 56,
							paddingHorizontal: 16
						}}
					>
						<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>Prefix</Text>
						<Text style={[m3Type.bodyLarge, { color: colors.label, fontFamily: monoFamily }]}>
							{apiKey.keyPrefix}
						</Text>
						<Icon name="doc.on.doc" size={20} color={m3.primary} />
					</Pressable>
				</M3Section>
				<M3Section title="Details">
					<ValueRow
						title="Assigned To"
						value={APIKeyOwnerText.detail(model.assignedUser, apiKey.userId)}
					/>
					<ValueRow
						title="Created"
						value={APIKeyDateText.detail(apiKey.createdAt, apiKey.createdAt)}
					/>
					<ValueRow title="Last Used" value={APIKeyDateText.detail(apiKey.lastUsedAt, 'Never')} />
					<ValueRow
						title="Expiration"
						value={APIKeyDateText.detail(apiKey.expiresAt, 'Never')}
						valueColor={model.isExpired ? systemColors.red : undefined}
					/>
					{model.access.supportsRBAC && model.metadata?.permissions ? (
						<ValueRow
							title="Permissions"
							value={`${model.metadata.permissions.length} ${model.metadata.kind === 'personal' ? 'inherited' : 'granted'}`}
						/>
					) : null}
					{apiKey.updatedAt ? (
						<ValueRow
							title="Updated"
							value={APIKeyDateText.detail(apiKey.updatedAt, apiKey.updatedAt)}
						/>
					) : null}
				</M3Section>
				{apiKey.description ? (
					<M3Section title="Description">
						<Text selectable style={[m3Type.bodyLarge, { color: colors.label, padding: 16 }]}>
							{apiKey.description}
						</Text>
					</M3Section>
				) : null}
				{model.isProtected ? (
					<M3Section>
						<Notice
							icon="lock.fill"
							iconColor={systemColors.orange}
							text={
								apiKey.isStatic
									? 'This static key is managed by Arcane and cannot be edited, rotated, or deleted.'
									: 'This key is paired with an environment and cannot be edited, rotated, or deleted.'
							}
						/>
					</M3Section>
				) : model.rotationNotice ? (
					<M3Section>
						<Notice
							icon="info.circle.fill"
							iconColor={colors.secondaryLabel as string}
							text={model.rotationNotice}
						/>
					</M3Section>
				) : null}
			</ScrollView>
		</>
	);
}
