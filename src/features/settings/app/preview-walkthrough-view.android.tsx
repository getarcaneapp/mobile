/**
 * Android rendering of `PreviewWalkthrough` (PreviewWalkthrough.swift): a
 * horizontal pager of Material pages with page dots and a filled
 * Enable Preview button on the last page.
 */
import { Stack } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { colors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { m3 } from '@/ui/components/material-colors';
import { m3Type } from '@/ui/components/type-scale';

import { usePreviewWalkthrough, type WalkthroughContent } from './preview-walkthrough';

export type PreviewWalkthroughViewProps = {
	content: WalkthroughContent;
	isEnabled: boolean;
	enable: () => void;
	illustration: (index: number) => ReactNode;
};

export function PreviewWalkthroughView({
	content,
	isEnabled,
	enable,
	illustration
}: PreviewWalkthroughViewProps) {
	const model = usePreviewWalkthrough(content, enable);
	const [width, setWidth] = useState(0);
	const pager = useRef<ScrollViewInstance>(null);
	const { pages, footnote } = content;

	return (
		<>
			<Stack.Screen
				options={{
					title: '',
					headerRight: () => (
						<Pressable
							onPress={model.finish}
							accessibilityRole="button"
							style={{ paddingHorizontal: 12, paddingVertical: 8 }}
						>
							<Text style={[m3Type.labelLarge, { color: m3.primary }]}>Done</Text>
						</Pressable>
					)
				}}
			/>
			<View
				style={{ flex: 1, backgroundColor: colors.systemBackground }}
				onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			>
				<ScrollView
					ref={pager}
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
					onMomentumScrollEnd={(event) => {
						if (width > 0) model.setPage(Math.round(event.nativeEvent.contentOffset.x / width));
					}}
					style={{ flex: 1 }}
				>
					{pages.map((page, index) => (
						<ScrollView
							key={page.title}
							style={{ width }}
							contentContainerStyle={{ padding: 24, gap: 24 }}
						>
							<View
								importantForAccessibility="no-hide-descendants"
								style={{
									gap: 16,
									padding: 24,
									borderRadius: Radius.hero,
									backgroundColor: colors.secondarySystemGroupedBackground,
									borderWidth: 1,
									borderColor: colors.separator
								}}
							>
								{illustration(index)}
							</View>
							<View style={{ alignItems: 'center', gap: 12 }}>
								<Text
									style={[
										m3Type.labelMedium,
										{
											color: m3.primary,
											paddingHorizontal: 10,
											paddingVertical: 5,
											borderRadius: 999,
											overflow: 'hidden',
											backgroundColor: m3.secondaryContainer
										}
									]}
								>
									Preview
								</Text>
								<Text
									style={[
										m3Type.headlineSmall,
										{
											color: colors.label,
											textAlign: 'center',
											fontWeight: '700',
											fontSize: 32,
											lineHeight: 40
										}
									]}
								>
									{page.title}
								</Text>
								<Text
									style={[m3Type.bodyLarge, { color: colors.secondaryLabel, textAlign: 'center' }]}
								>
									{page.message}
								</Text>
							</View>
							{index === model.lastPage ? (
								<>
									<Text
										style={[
											m3Type.bodySmall,
											{ color: colors.secondaryLabel, textAlign: 'center' }
										]}
									>
										{footnote}
									</Text>
									{!isEnabled ? (
										<Pressable
											onPress={model.enableAndFinish}
											accessibilityRole="button"
											android_ripple={{ color: withOpacity('#FFFFFF', 0.2) }}
											style={{
												minHeight: 56,
												borderRadius: 28,
												alignItems: 'center',
												justifyContent: 'center',
												backgroundColor: m3.primary
											}}
										>
											<Text style={[m3Type.labelLarge, { color: m3.onPrimary }]}>
												Enable Preview
											</Text>
										</Pressable>
									) : null}
								</>
							) : null}
						</ScrollView>
					))}
				</ScrollView>
				<View
					accessible
					accessibilityLabel={`Page ${model.page + 1} of ${pages.length}`}
					style={{
						flexDirection: 'row',
						justifyContent: 'center',
						gap: 8,
						paddingHorizontal: 24,
						paddingVertical: 16
					}}
				>
					{pages.map((page, index) => (
						<Pressable
							key={page.title}
							onPress={() => {
								model.setPage(index);
								pager.current?.scrollTo({ x: index * width, animated: true });
							}}
							hitSlop={8}
							style={{
								width: 7,
								height: 7,
								borderRadius: 3.5,
								backgroundColor: index === model.page ? m3.primary : colors.separator
							}}
						/>
					))}
				</View>
			</View>
		</>
	);
}
