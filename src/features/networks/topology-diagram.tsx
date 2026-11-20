import {
	memo,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode
} from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withDecay,
	withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import type { TopologyNode } from '@/sdk/models/network/Topology';
import { colors, systemColors, withOpacity } from '@/theme/colors';
import { Radius } from '@/theme/tokens';
import { secondaryHex, useIsDark, useReduceMotion } from '@/ui/components/accessibility';
import { m3 } from '@/ui/components/material-colors';
import { monoFamily } from '@/ui/components/type-scale';
import { Icon } from '@/ui/Icon';

import {
	capitalizedWords,
	fitScale,
	nodeAccent,
	nodeAccessibilityDescription,
	nodeAddressLines,
	nodeTitle,
	networkSummary,
	type TopologyGraphLayout,
	type TopologyPlacement,
	TopologyScale,
	widthFitScale
} from './topology-layout';
import { GlassSurface } from '@/ui/glass';

const edgeInset = 12;
const legendInset = 44;
const minimumScale = TopologyScale.minimum;
const maximumScale = TopologyScale.maximum;

function useSecondary(opacity: number) {
	const isDark = useIsDark();
	return withOpacity(secondaryHex[isDark ? 'dark' : 'light'], 0.6 * opacity);
}

function Material({ style, children }: { style: object; children: ReactNode }) {
	if (Platform.OS === 'ios') {
		return <GlassSurface style={[style, { overflow: 'hidden' }]}>{children}</GlassSurface>;
	}
	return <View style={[style, { backgroundColor: m3.surfaceContainerHigh }]}>{children}</View>;
}

function GridBackground() {
	const fill = useSecondary(0.18);
	return (
		<Svg
			style={StyleSheet.absoluteFill}
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<Defs>
				<Pattern
					id="topology-grid"
					x={0}
					y={0}
					width={18}
					height={18}
					patternUnits="userSpaceOnUse"
				>
					<Circle cx={9.75} cy={9.75} r={0.75} fill={fill} />
				</Pattern>
			</Defs>
			<Rect x={0} y={0} width="100%" height="100%" fill="url(#topology-grid)" />
		</Svg>
	);
}

const railRadius = 10;

function RailCanvas({ graph }: { graph: TopologyGraphLayout }) {
	const stroke = useSecondary(0.5);
	const segments: string[] = [];
	for (const rail of graph.rails) {
		const last = rail.stops[rail.stops.length - 1];
		if (last === undefined) continue;
		segments.push(`M${rail.x} ${rail.top} V${last - railRadius}`);
		for (const stop of rail.stops)
			segments.push(
				`M${rail.x} ${stop - railRadius} Q${rail.x} ${stop} ${rail.x + railRadius} ${stop} H${rail.childLeft}`
			);
	}
	return (
		<Svg
			width={graph.contentSize.width}
			height={graph.contentSize.height}
			style={StyleSheet.absoluteFill}
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<Path
				d={segments.join(' ')}
				stroke={stroke}
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
		</Svg>
	);
}

function NodeBadge({ text, color }: { text: string; color: string }) {
	return (
		<Text
			style={{
				fontSize: 12,
				fontWeight: '600',
				color,
				paddingHorizontal: 8,
				paddingVertical: 3,
				borderRadius: 999,
				overflow: 'hidden',
				backgroundColor: withOpacity(color, 0.14)
			}}
		>
			{text}
		</Text>
	);
}

function NodeCard({
	placement,
	onSelect
}: {
	placement: TopologyPlacement;
	onSelect: (node: TopologyNode) => void;
}) {
	const secondary = useSecondary(1);
	const { node, kind, connections, frame } = placement;
	const isNetwork = kind === 'network';
	const isLink = kind === 'link';
	const accent = nodeAccent(node) ?? secondary;
	const addressLines = nodeAddressLines(node, connections);
	const extraNetworks = placement.memberCount - 1;
	const iconSize = isLink ? 26 : 34;
	return (
		<Pressable
			onPress={() => onSelect(node)}
			accessibilityRole="button"
			accessibilityLabel={nodeAccessibilityDescription(node, connections)}
			accessibilityHint="Shows topology details"
			style={{
				position: 'absolute',
				left: frame.x,
				top: frame.y,
				width: frame.width,
				height: frame.height,
				paddingHorizontal: 12,
				justifyContent: 'center',
				gap: 6,
				borderRadius: Radius.standard,
				borderCurve: 'continuous',
				borderWidth: 1,
				borderStyle: isLink ? 'dashed' : 'solid',
				borderColor: withOpacity(accent, isLink ? 0.4 : 0.55),
				backgroundColor: isLink ? 'transparent' : colors.secondarySystemGroupedBackground
			}}
		>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
				<View
					style={{
						width: iconSize,
						height: iconSize,
						borderRadius: iconSize / 2,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: withOpacity(accent, 0.14)
					}}
				>
					<Icon
						name={isNetwork ? 'network' : 'shippingbox.fill'}
						size={isLink ? 14 : 18}
						color={accent}
					/>
				</View>
				<View style={{ flex: 1, gap: 1 }}>
					<Text
						numberOfLines={1}
						style={{ fontSize: isLink ? 15 : 16, fontWeight: '600', color: colors.label }}
					>
						{nodeTitle(node)}
					</Text>
					{isNetwork ? (
						<Text numberOfLines={1} style={{ fontSize: 13, color: secondary }}>
							{networkSummary(node)}
						</Text>
					) : isLink ? (
						<Text
							numberOfLines={1}
							style={{ fontSize: 12, fontFamily: monoFamily, color: secondary }}
						>
							{addressLines[0] ?? 'No address'}
						</Text>
					) : node.metadata.status ? (
						<Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '500', color: accent }}>
							{capitalizedWords(node.metadata.status)}
						</Text>
					) : null}
				</View>
				{isNetwork ? (
					node.metadata.isDefault === true ? (
						<NodeBadge text="Default" color={systemColors.teal} />
					) : (
						<NodeBadge text={String(placement.memberCount)} color={secondary} />
					)
				) : extraNetworks > 0 && !isLink ? (
					<NodeBadge text={`+${extraNetworks}`} color={systemColors.teal} />
				) : null}
			</View>
			{kind === 'container' ? (
				<View style={{ gap: 3 }}>
					{node.metadata.image ? (
						<Text numberOfLines={1} style={{ fontSize: 12, color: secondary }}>
							{node.metadata.image}
						</Text>
					) : null}
					{addressLines[0] ? (
						<Text
							numberOfLines={1}
							style={{ fontSize: 12, fontFamily: monoFamily, color: secondary }}
						>
							{addressLines[0]}
						</Text>
					) : null}
				</View>
			) : null}
		</Pressable>
	);
}

const GraphContent = memo(
	function GraphContent({
		graph,
		onSelect
	}: {
		graph: TopologyGraphLayout;
		revision: number;
		onSelect: (node: TopologyNode) => void;
	}) {
		return (
			<View style={{ width: graph.contentSize.width, height: graph.contentSize.height }}>
				<RailCanvas graph={graph} />
				{graph.placements.map((placement) => (
					<NodeCard key={placement.key} placement={placement} onSelect={onSelect} />
				))}
			</View>
		);
	},
	(previous, next) => previous.revision === next.revision
);

export function TopologyDiagram({
	graph,
	revision,
	onSelect
}: {
	graph: TopologyGraphLayout;
	revision: number;
	onSelect: (node: TopologyNode) => void;
}) {
	const reduceMotion = useReduceMotion();
	const separator = useSecondary((0.29 * 0.45) / 0.6);
	const scale = useSharedValue(1);
	const savedScale = useSharedValue(1);
	const offsetX = useSharedValue(0);
	const offsetY = useSharedValue(0);
	const savedX = useSharedValue(0);
	const savedY = useSharedValue(0);
	const [viewport, setViewport] = useState({ width: 0, height: 0 });
	const hasFitted = useRef(false);
	const onSelectRef = useRef(onSelect);
	useLayoutEffect(() => {
		onSelectRef.current = onSelect;
	});
	const [select] = useState(() => (node: TopologyNode) => onSelectRef.current(node));

	const viewWidth = useSharedValue(0);
	const viewHeight = useSharedValue(0);
	const isOverview = useRef(false);
	const contentWidth = graph.contentSize.width;
	const contentHeight = graph.contentSize.height;

	const limits = (currentScale: number) => {
		'worklet';
		const overflowX = (contentWidth * currentScale - viewWidth.value) / 2;
		const overflowY = (contentHeight * currentScale - viewHeight.value) / 2;
		return {
			minX: overflowX > 0 ? -overflowX - edgeInset : 0,
			maxX: overflowX > 0 ? overflowX + edgeInset : 0,
			minY: overflowY > 0 ? -overflowY - edgeInset : overflowY + edgeInset + legendInset,
			maxY: overflowY + edgeInset + legendInset
		};
	};

	const fit = (size: { width: number; height: number }, animated: boolean, overview: boolean) => {
		if (size.width <= 0 || size.height <= 0) return;
		const target = overview
			? fitScale({ width: size.width, height: size.height - legendInset }, graph.contentSize)
			: widthFitScale(size, graph.contentSize);
		const top = (contentHeight * target - size.height) / 2 + edgeInset + legendInset;
		const duration = animated && !reduceMotion ? 300 : 0;
		scale.set(duration > 0 ? withTiming(target, { duration }) : target);
		offsetX.set(duration > 0 ? withTiming(0, { duration }) : 0);
		offsetY.set(duration > 0 ? withTiming(top, { duration }) : top);
		savedScale.set(target);
		savedX.set(0);
		savedY.set(top);
		isOverview.current = overview;
	};

	const fitViewport = useEffectEvent((width: number, height: number) => {
		viewWidth.set(width);
		viewHeight.set(height);
		fit({ width, height }, hasFitted.current, false);
		if (width > 0) hasFitted.current = true;
	});

	useEffect(() => {
		fitViewport(viewport.width, viewport.height);
	}, [viewport.width, viewport.height]);

	const pan = Gesture.Pan()
		.minDistance(5)
		.onBegin(() => {
			cancelAnimation(offsetX);
			cancelAnimation(offsetY);
			savedX.set(offsetX.value);
			savedY.set(offsetY.value);
		})
		.onUpdate((event) => {
			const bounds = limits(scale.value);
			offsetX.set(Math.min(Math.max(savedX.value + event.translationX, bounds.minX), bounds.maxX));
			offsetY.set(Math.min(Math.max(savedY.value + event.translationY, bounds.minY), bounds.maxY));
		})
		.onEnd((event) => {
			const bounds = limits(scale.value);
			offsetX.set(withDecay({ velocity: event.velocityX, clamp: [bounds.minX, bounds.maxX] }));
			offsetY.set(withDecay({ velocity: event.velocityY, clamp: [bounds.minY, bounds.maxY] }));
		});
	const pinch = Gesture.Pinch()
		.onUpdate((event) => {
			scale.set(Math.min(Math.max(savedScale.value * event.scale, minimumScale), maximumScale));
		})
		.onEnd(() => {
			savedScale.set(scale.value);
			const bounds = limits(scale.value);
			offsetX.set(withTiming(Math.min(Math.max(offsetX.value, bounds.minX), bounds.maxX)));
			offsetY.set(withTiming(Math.min(Math.max(offsetY.value, bounds.minY), bounds.maxY)));
		});
	const gesture = Gesture.Simultaneous(pan, pinch);

	const contentStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: offsetX.value },
			{ translateY: offsetY.value },
			{ scale: scale.value }
		]
	}));

	const onLayout = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout;
		if (width !== viewport.width || height !== viewport.height) setViewport({ width, height });
	};

	return (
		<View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 12 }}>
			<View
				style={{
					flex: 1,
					borderRadius: Radius.card,
					borderCurve: 'continuous',
					overflow: 'hidden',
					backgroundColor: colors.systemGroupedBackground,
					borderWidth: 1,
					borderColor: separator
				}}
			>
				<GestureDetector gesture={gesture}>
					<View style={{ flex: 1 }} onLayout={onLayout} collapsable={false}>
						<GridBackground />
						<Animated.View
							style={[
								{
									position: 'absolute',
									width: graph.contentSize.width,
									height: graph.contentSize.height,
									left: (viewport.width - graph.contentSize.width) / 2,
									top: (viewport.height - graph.contentSize.height) / 2
								},
								contentStyle
							]}
						>
							<GraphContent graph={graph} revision={revision} onSelect={select} />
						</Animated.View>
					</View>
				</GestureDetector>
				<View
					style={{ position: 'absolute', top: 12, left: 12 }}
					accessible
					accessibilityLabel="Diagram legend: teal nodes are networks, status-colored nodes are containers"
				>
					<Material
						style={{
							flexDirection: 'row',
							gap: 8,
							paddingHorizontal: 10,
							paddingVertical: 8,
							borderRadius: 999
						}}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
							<Icon name="network" size={12} color={systemColors.teal} />
							<Text style={{ fontSize: 12, fontWeight: '600', color: systemColors.teal }}>
								Networks
							</Text>
						</View>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
							<Icon name="shippingbox" size={12} color={systemColors.green} />
							<Text style={{ fontSize: 12, fontWeight: '600', color: systemColors.green }}>
								Containers
							</Text>
						</View>
					</Material>
				</View>
				<Pressable
					onPress={() => fit(viewport, true, !isOverview.current)}
					accessibilityRole="button"
					accessibilityLabel="Fit topology to screen"
					style={{ position: 'absolute', right: 12, bottom: 12 }}
				>
					<Material
						style={{
							width: 40,
							height: 40,
							borderRadius: 20,
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<Icon
							name="arrow.up.left.and.arrow.down.right"
							size={17}
							color={Platform.OS === 'ios' ? colors.label : m3.onSurfaceVariant}
						/>
					</Material>
				</Pressable>
			</View>
		</View>
	);
}
