import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { M3Section } from '@/features/containers/android-material';
import { AndroidToolbar } from '@/features/containers/android-toolbar';
import { colors } from '@/theme/colors';
import { m3 } from '@/ui/components/material-colors';
import { m3Type, monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import { ripple, TextAction } from './compose-android-kit';
import { useProjectDraftReview } from './use-project-draft-review';

function ChangeRow({ icon, text }: { icon?: string; text: string }) {
	return (
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 16,
				minHeight: 48,
				paddingHorizontal: 16,
				paddingVertical: 10
			}}
		>
			{icon ? <Icon name={icon} size={22} color={m3.primary} /> : null}
			<Text style={[icon ? m3Type.bodyLarge : m3Type.bodyMedium, { color: colors.label, flex: 1 }]}>
				{text}
			</Text>
		</View>
	);
}

export function ProjectDraftReviewScreen() {
	const model = useProjectDraftReview();
	const [diffExpanded, setDiffExpanded] = useState(false);
	return (
		<>
			<Stack.Screen options={{ title: 'Review Changes' }} />
			<AndroidToolbar
				placement="left"
				items={[
					{ kind: 'button', id: 'cancel', icon: 'xmark', label: 'Cancel', onPress: model.cancel }
				]}
			/>
			<ScrollView
				style={{ backgroundColor: colors.systemGroupedBackground }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<M3Section title="Changes">
					{model.composeChanged ? (
						<ChangeRow icon="doc.text" text="Compose configuration changed" />
					) : null}
					{model.serviceChanges.map((change) => (
						<ChangeRow key={change} text={change} />
					))}
					{model.environmentChanged ? (
						<ChangeRow icon="key" text="Environment variables changed" />
					) : null}
					{model.additionalChanges.map((change) => (
						<ChangeRow key={`additional-${change}`} text={change} />
					))}
				</M3Section>
				{model.composeChanged ? (
					<M3Section>
						<Pressable
							onPress={() => setDiffExpanded(!diffExpanded)}
							android_ripple={ripple}
							accessibilityRole="button"
							accessibilityState={{ expanded: diffExpanded }}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								minHeight: 56,
								paddingHorizontal: 16
							}}
						>
							<Text style={[m3Type.bodyLarge, { color: colors.label, flex: 1 }]}>YAML Diff</Text>
							<Icon
								name={diffExpanded ? 'chevron.up' : 'chevron.down'}
								size={20}
								color={colors.secondaryLabel}
							/>
						</Pressable>
						{diffExpanded ? (
							<View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
								<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
									This diff may contain sensitive values.
								</Text>
								<ScrollView horizontal>
									<Text
										selectable
										style={[m3Type.bodySmall, { color: colors.label, fontFamily: monoFamily }]}
									>
										{model.sourceDiff}
									</Text>
								</ScrollView>
							</View>
						) : null}
					</M3Section>
				) : null}
				<M3Section footer="Saving stores your files. Deployment is a separate operation.">
					<TextAction title={model.saveTitle} onPress={() => model.save(false)} />
					{model.canDeploy ? (
						<TextAction title="Save and deploy" onPress={() => model.save(true)} />
					) : null}
				</M3Section>
			</ScrollView>
		</>
	);
}
