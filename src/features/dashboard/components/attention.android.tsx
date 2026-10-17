/**
 * Android (Material 3) renderings of NeedsAttentionSection.swift: the toolbar
 * button (badged icon; tap → summary sheet, long press → Attention Center),
 * `AttentionItemRow`, and the Attention Center sheet.
 *
 * Standalone (RN views + Compose sheets).
 */
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Icon } from '@/ui/Icon';
import { m3 } from '@/ui/components/material-colors';
import { RowIcon } from '@/ui/components/row-icon';
import { m3Type } from '@/ui/components/type-scale';
import { MaterialSectionHeader } from '@/ui/material/list';

import {
	attentionButtonAppearance,
	severityTitle,
	type NeedsAttentionItem
} from '../dashboard-logic';
import { DashboardRowChevron } from './dashboard-parts';
import { MaterialSheet } from './material-sheet';

const severityTint = (item: NeedsAttentionItem) =>
	item.severity === 'critical' ? systemColors.red : systemColors.orange;

export function AttentionItemRow({
	item,
	showsDetail = false
}: {
	item: NeedsAttentionItem;
	showsDetail?: boolean;
}) {
	const tint = severityTint(item);
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<RowIcon systemImage={item.icon} tint={tint} size={30} changeToken={String(item.count)} />
			<View style={{ flex: 1, gap: 2 }}>
				<Text numberOfLines={1} style={[m3Type.titleSmall, { color: colors.label }]}>
					{item.title}
				</Text>
				{showsDetail ? (
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>{item.detail}</Text>
				) : null}
			</View>
			<Text
				style={[
					m3Type.labelMedium,
					{
						color: tint,
						paddingHorizontal: 8,
						paddingVertical: 3,
						borderRadius: 10,
						overflow: 'hidden',
						backgroundColor: withOpacity(tint, 0.14)
					}
				]}
			>
				{String(item.count)}
			</Text>
			<DashboardRowChevron />
		</View>
	);
}

function ItemButton({
	item,
	onSelect,
	showsDetail
}: {
	item: NeedsAttentionItem;
	onSelect: (item: NeedsAttentionItem) => void;
	showsDetail?: boolean;
}) {
	return (
		<Pressable
			onPress={() => onSelect(item)}
			android_ripple={{ color: colors.separator as string }}
			accessibilityRole="button"
			accessibilityLabel={`${item.title}: ${item.count}`}
			style={{ paddingHorizontal: 24, paddingVertical: 10 }}
		>
			<AttentionItemRow item={item} showsDetail={showsDetail} />
		</Pressable>
	);
}

const maximumRows = 4;

/** The toolbar entry point (renders inside a `Stack.Toolbar.View`). */
export function AttentionToolbarButton({
	items,
	setPresented,
	onOpenCenter
}: {
	items: NeedsAttentionItem[];
	isPresented: boolean;
	setPresented: (value: boolean) => void;
	onSelect: (item: NeedsAttentionItem) => void;
	onOpenCenter: () => void;
}) {
	const { symbol, tint } = attentionButtonAppearance(items);
	return (
		<Pressable
			onPress={() => setPresented(true)}
			onLongPress={() => {
				void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
				setPresented(false);
				onOpenCenter();
			}}
			delayLongPress={400}
			accessibilityRole="button"
			accessibilityLabel={
				items.length === 0
					? 'Attention Center, all clear'
					: `Attention Center, ${items.length} items`
			}
			accessibilityHint="Tap for a summary. Hold to open the Attention Center."
			hitSlop={8}
			style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
		>
			<Icon name={symbol} size={22} color={systemColors[tint]} />
			{items.length > 0 ? (
				<View
					style={{
						position: 'absolute',
						top: 4,
						right: 2,
						minWidth: 16,
						height: 16,
						paddingHorizontal: 4,
						borderRadius: 8,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: m3.error
					}}
				>
					<Text style={[m3Type.labelSmall, { color: m3.onError, lineHeight: 14 }]}>
						{String(items.length)}
					</Text>
				</View>
			) : null}
		</Pressable>
	);
}

/** The compact summary (SwiftUI's popover) as a Material bottom sheet. */
export function AttentionSummarySheet({
	items,
	isPresented,
	setPresented,
	onSelect
}: {
	items: NeedsAttentionItem[];
	isPresented: boolean;
	setPresented: (value: boolean) => void;
	onSelect: (item: NeedsAttentionItem) => void;
}) {
	const visible = items.slice(0, maximumRows);
	return (
		<MaterialSheet isPresented={isPresented} onDismiss={() => setPresented(false)}>
			<View style={{ paddingBottom: 24 }}>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'baseline',
						paddingHorizontal: 24,
						paddingBottom: 6
					}}
				>
					<Text style={[m3Type.titleMedium, { flex: 1, color: colors.label }]}>
						Needs Attention
					</Text>
					<Text style={[m3Type.bodySmall, { color: colors.secondaryLabel }]}>
						{items.length === 0 ? 'All clear' : `${items.length} items`}
					</Text>
				</View>
				{items.length === 0 ? (
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 6,
							paddingHorizontal: 24,
							paddingVertical: 10
						}}
					>
						<Icon name="checkmark.circle.fill" size={18} color={colors.secondaryLabel} />
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							Everything looks healthy.
						</Text>
					</View>
				) : (
					<>
						{visible.map((item) => (
							<ItemButton key={item.id} item={item} onSelect={onSelect} />
						))}
						{items.length > visible.length ? (
							<Text
								style={[
									m3Type.bodySmall,
									{ color: colors.secondaryLabel, paddingHorizontal: 24, paddingVertical: 8 }
								]}
							>
								{`${items.length - visible.length} more in the Attention Center`}
							</Text>
						) : null}
					</>
				)}
			</View>
		</MaterialSheet>
	);
}

export function AttentionCenterSheet({
	isPresented,
	items,
	onSelect,
	onDismiss
}: {
	isPresented: boolean;
	items: NeedsAttentionItem[];
	onSelect: (item: NeedsAttentionItem) => void;
	onDismiss: () => void;
}) {
	const critical = items.filter((i) => i.severity === 'critical');
	const warnings = items.filter((i) => i.severity === 'warning');
	return (
		<MaterialSheet isPresented={isPresented} onDismiss={onDismiss}>
			<View style={{ paddingBottom: 32 }}>
				<Text
					style={[
						m3Type.titleLarge,
						{ color: colors.label, paddingHorizontal: 24, paddingBottom: 8 }
					]}
				>
					Attention Center
				</Text>
				{items.length === 0 ? (
					<View style={{ alignItems: 'center', gap: 8, padding: 32 }}>
						<Icon name="checkmark.shield.fill" size={40} color={colors.secondaryLabel} />
						<Text style={[m3Type.titleMedium, { color: colors.label }]}>All Clear</Text>
						<Text style={[m3Type.bodyMedium, { color: colors.secondaryLabel }]}>
							Nothing needs your attention right now.
						</Text>
					</View>
				) : (
					<>
						{critical.length > 0 ? <MaterialSectionHeader title={severityTitle.critical} /> : null}
						{critical.map((item) => (
							<ItemButton key={item.id} item={item} onSelect={onSelect} showsDetail />
						))}
						{warnings.length > 0 ? <MaterialSectionHeader title={severityTitle.warning} /> : null}
						{warnings.map((item) => (
							<ItemButton key={item.id} item={item} onSelect={onSelect} showsDetail />
						))}
					</>
				)}
			</View>
		</MaterialSheet>
	);
}
