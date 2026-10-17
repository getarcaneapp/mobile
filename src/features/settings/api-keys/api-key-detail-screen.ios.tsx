import { Host } from '@/ui/host';
import {
	Button,
	Form,
	HStack,
	Label,
	LabeledContent,
	Section,
	Spacer,
	Text,
	VStack
} from '@expo/ui/swift-ui';
import { Image } from '@/ui/components/swiftui-image';
import {
	accessibilityLabel,
	buttonStyle,
	fixedSize,
	font,
	foregroundStyle,
	frame,
	multilineTextAlignment
} from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useAccentColor } from '@/theme/accent';
import { systemColors } from '@/theme/colors';
import { AppToolbar } from '@/ui/components/toolbar';

import { APIKeyDateText, APIKeyOwnerText } from './api-key-models';
import { APIKeyStatusBadge } from './api-key-row';
import { useAPIKeyDetail } from './use-api-key-detail';
import { symbolRenderingMode } from '../../../../modules/arcane-swiftui-extras';

function DetailRow({ label, value, tint }: { label: string; value: string; tint?: string }) {
	return (
		<LabeledContent label={label}>
			<Text
				modifiers={[
					foregroundStyle(tint ?? 'secondary'),
					multilineTextAlignment('trailing'),
					fixedSize({ horizontal: false, vertical: true })
				]}
			>
				{value}
			</Text>
		</LabeledContent>
	);
}

export function APIKeyDetailScreen() {
	const model = useAPIKeyDetail();
	const accent = useAccentColor();
	const { apiKey } = model;
	if (!apiKey)
		return <Stack.Screen options={{ title: 'API Key', headerLargeTitleEnabled: false }} />;

	return (
		<>
			<Stack.Screen options={{ title: 'API Key', headerLargeTitleEnabled: false }} />
			{model.actionItems.length > 0 ? (
				<AppToolbar>
					<Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="API key actions">
						{model.actionItems.map((item) => (
							<Stack.Toolbar.MenuAction
								key={item.id}
								icon={item.systemImage as SFSymbol}
								destructive={item.role === 'destructive'}
								disabled={model.runningActionID !== undefined}
								onPress={() => model.requestAction(item)}
							>
								{item.title}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</AppToolbar>
			) : null}
			<Host style={{ flex: 1 }}>
				<Form>
					<Section>
						<HStack spacing={14}>
							<Image
								systemName="key.fill"
								modifiers={[
									font({ textStyle: 'largeTitle' }),
									symbolRenderingMode('hierarchical'),
									foregroundStyle(systemColors.yellow),
									frame({ width: 48 })
								]}
							/>
							<VStack alignment="leading" spacing={5}>
								<Text
									modifiers={[
										font({ textStyle: 'headline' }),
										fixedSize({ horizontal: false, vertical: true })
									]}
								>
									{apiKey.name}
								</Text>
								<HStack spacing={6}>
									<APIKeyStatusBadge isExpired={model.isExpired} />
									<Text
										modifiers={[
											font({ textStyle: 'caption2', weight: 'semibold' }),
											foregroundStyle({ type: 'hierarchical', style: 'secondary' })
										]}
									>
										{model.kindLabel}
									</Text>
								</HStack>
							</VStack>
							<Spacer minLength={0} />
						</HStack>
					</Section>
					<Section title="Key">
						<Button
							onPress={model.copyPrefix}
							modifiers={[
								buttonStyle('plain'),
								accessibilityLabel(`Key prefix ${apiKey.keyPrefix}, copy`)
							]}
						>
							<LabeledContent label="Prefix">
								<HStack spacing={8}>
									<Text
										modifiers={[
											font({ textStyle: 'body', design: 'monospaced' }),
											foregroundStyle('primary'),
											fixedSize({ horizontal: false, vertical: true })
										]}
									>
										{apiKey.keyPrefix}
									</Text>
									<Image systemName="doc.on.doc" modifiers={[foregroundStyle(accent)]} />
								</HStack>
							</LabeledContent>
						</Button>
					</Section>
					<Section title="Details">
						<DetailRow
							label="Assigned To"
							value={APIKeyOwnerText.detail(model.assignedUser, apiKey.userId)}
						/>
						<DetailRow
							label="Created"
							value={APIKeyDateText.detail(apiKey.createdAt, apiKey.createdAt)}
						/>
						<DetailRow
							label="Last Used"
							value={APIKeyDateText.detail(apiKey.lastUsedAt, 'Never')}
						/>
						<DetailRow
							label="Expiration"
							value={APIKeyDateText.detail(apiKey.expiresAt, 'Never')}
							tint={model.isExpired ? systemColors.red : undefined}
						/>
						{model.access.supportsRBAC && model.metadata?.permissions ? (
							<DetailRow
								label="Permissions"
								value={`${model.metadata.permissions.length} ${model.metadata.kind === 'personal' ? 'inherited' : 'granted'}`}
							/>
						) : null}
						{apiKey.updatedAt ? (
							<DetailRow
								label="Updated"
								value={APIKeyDateText.detail(apiKey.updatedAt, apiKey.updatedAt)}
							/>
						) : null}
					</Section>
					{apiKey.description ? (
						<Section title="Description">
							<Text>{apiKey.description}</Text>
						</Section>
					) : null}
					{model.isProtected ? (
						<Section>
							<Label
								title={
									apiKey.isStatic
										? 'This static key is managed by Arcane and cannot be edited, rotated, or deleted.'
										: 'This key is paired with an environment and cannot be edited, rotated, or deleted.'
								}
								icon={
									<Image
										systemName="lock.fill"
										modifiers={[foregroundStyle(systemColors.orange)]}
									/>
								}
								modifiers={[
									font({ textStyle: 'callout' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
									fixedSize({ horizontal: false, vertical: true })
								]}
							/>
						</Section>
					) : model.rotationNotice ? (
						<Section>
							<Label
								title={model.rotationNotice}
								systemImage="info.circle.fill"
								modifiers={[
									font({ textStyle: 'callout' }),
									foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
									fixedSize({ horizontal: false, vertical: true })
								]}
							/>
						</Section>
					) : null}
				</Form>
			</Host>
		</>
	);
}
