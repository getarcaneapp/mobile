/**
 * Port of `NetworkTopologyDiagram`, `TopologyGridBackground`,
 * `TopologyEdgeCanvas` and `TopologyNodeCard` (NetworkTopologyView.swift):
 * a pannable, zoomable graph of networks and their containers.
 *
 * Standalone (RN view: react-native-svg + gesture handler + Reanimated).
 */
import { BlurView } from 'expo-blur';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
	nodePosition,
	nodeSize,
	nodeTitle,
	networkSummary,
	type TopologyConnection,
	type TopologyGraphLayout,
	TopologyScale
} from './topology-layout';

const minimumScale = TopologyScale.minimum;
const maximumScale = TopologyScale.maximum;

/** `Color.secondary` at `opacity` as a hex string. */
function useSecondary(opacity: number) {
	const isDark = useIsDark();
	return withOpacity(secondaryHex[isDark ? 'dark' : 'light'], 0.6 * opacity);
}

function Material({ style, children }: { style: object; children: ReactNode }) {
	if (Platform.OS === 'ios') {
		return (
			<BlurView tint="systemMaterial" intensity={100} style={[style, { overflow: 'hidden' }]}>
				{children}
			</BlurView>
		);
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

function EdgeCanvas({ graph }: { graph: TopologyGraphLayout }) {
	const stroke = useSecondary(0.42);
	const arrowFill = useSecondary(0.55);
	const connectors: string[] = [];
	const arrows: string[] = [];
	for (const edge of graph.edges) {
		const source = graph.nodeByID.get(edge.source);
		const target = graph.nodeByID.get(edge.target);
		if (!source || !target) continue;
		const sp = nodePosition(graph, source);
		const tp = nodePosition(graph, target);
		const start = { x: sp.x + nodeSize(source).width / 2, y: sp.y };
		const end = { x: tp.x - nodeSize(target).width / 2, y: tp.y };
		const control = Math.max((end.x - start.x) * 0.45, 40);
		connectors.push(
			`M${start.x} ${start.y} C${start.x + control} ${start.y} ${end.x - control} ${end.y} ${end.x} ${end.y}`
		);
		arrows.push(`M${end.x} ${end.y} L${end.x - 9} ${end.y - 5} L${end.x - 9} ${end.y + 5} Z`);
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
				d={connectors.join(' ')}
				stroke={stroke}
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			<Path d={arrows.join(' ')} fill={arrowFill} />
		</Svg>
	);
}

function NodeCard({
	node,
	connections,
	onSelect
}: {
	node: TopologyNode;
	connections: TopologyConnection[];
	onSelect: (node: TopologyNode) => void;
}) {
	const secondary = useSecondary(1);
	const tertiary = useSecondary(0.5);
	const isNetwork = node.type === 'network';
	const accent = nodeAccent(node) ?? secondary;
	const addressLines = nodeAddressLines(node, connections);
	const summary = networkSummary(node);
	const size = nodeSize(node);
	return (
		<Pressable
			onPress={() => onSelect(node)}
			accessibilityRole="button"
			accessibilityLabel={nodeAccessibilityDescription(node, connections)}
			accessibilityHint="Shows topology details"
			style={{
				position: 'absolute',
				width: size.width,
				height: size.height,
				padding: 14,
				gap: 8,
				borderRadius: Radius.standard,
				borderCurve: 'continuous',
				borderWidth: 1,
				borderColor: withOpacity(accent, 0.55),
				backgroundColor: colors.secondarySystemGroupedBackground
			}}
		>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
				<View
					style={{
						width: 32,
						height: 32,
						borderRadius: 16,
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: withOpacity(accent, 0.12)
					}}
				>
					<Icon name={isNetwork ? 'network' : 'shippingbox.fill'} size={17} color={accent} />
				</View>
				<View style={{ flex: 1, gap: 2 }}>
					<Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.label }}>
						{nodeTitle(node)}
					</Text>
					{isNetwork ? (
						<Text numberOfLines={1} style={{ fontSize: 12, color: secondary }}>
							{summary}
						</Text>
					) : node.metadata.status ? (
						<Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '500', color: accent }}>
							{capitalizedWords(node.metadata.status)}
						</Text>
					) : null}
				</View>
				{node.metadata.isDefault === true ? (
					<Text
						style={{
							fontSize: 11,
							fontWeight: '600',
							color: systemColors.teal,
							paddingHorizontal: 6,
							paddingVertical: 3,
							borderRadius: 999,
							overflow: 'hidden',
							backgroundColor: withOpacity(systemColors.teal, 0.12)
						}}
					>
						Default
					</Text>
				) : null}
			</View>
			{!isNetwork ? (
				<>
					{node.metadata.image ? (
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
							<Icon name="opticaldisc" size={11} color={secondary} />
							<Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: secondary }}>
								{node.metadata.image}
							</Text>
						</View>
					) : null}
					{addressLines.slice(0, 2).map((line, index) => (
						<View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
							<Icon name="number" size={11} color={secondary} />
							<Text
								numberOfLines={1}
								style={{ flex: 1, fontSize: 11, fontFamily: monoFamily, color: secondary }}
							>
								{line}
							</Text>
						</View>
					))}
					{addressLines.length > 2 ? (
						<Text
							style={{ fontSize: 11, color: tertiary }}
						>{`+${addressLines.length - 2} more connections`}</Text>
					) : null}
				</>
			) : null}
		</Pressable>
	);
}

/** `TopologyGraphContent`: equatable on the layout revision, so pan/zoom never re-render the nodes. */
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
				<EdgeCanvas graph={graph} />
				{graph.nodes.map((node) => {
					const position = nodePosition(graph, node);
					const size = nodeSize(node);
					return (
						<View
							key={node.id}
							style={{
								position: 'absolute',
								left: position.x - size.width / 2,
								top: position.y - size.height / 2
							}}
						>
							<NodeCard
								node={node}
								connections={graph.connectionsByNode.get(node.id) ?? []}
								onSelect={onSelect}
							/>
						</View>
					);
				})}
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
	onSelectRef.current = onSelect;
	const [select] = useState(() => (node: TopologyNode) => onSelectRef.current(node));

	const fit = (size: { width: number; height: number }, animated: boolean) => {
		if (size.width <= 0 || size.height <= 0) return;
		const target = fitScale(size, graph.contentSize);
		const duration = animated && !reduceMotion ? 300 : 0;
		scale.value = duration > 0 ? withTiming(target, { duration }) : target;
		offsetX.value = duration > 0 ? withTiming(0, { duration }) : 0;
		offsetY.value = duration > 0 ? withTiming(0, { duration }) : 0;
		savedScale.value = target;
		savedX.value = 0;
		savedY.value = 0;
	};

	useEffect(() => {
		fit(viewport, hasFitted.current);
		if (viewport.width > 0) hasFitted.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewport.width, viewport.height]);

	const pan = Gesture.Pan()
		.minDistance(5)
		.onUpdate((event) => {
			offsetX.value = savedX.value + event.translationX;
			offsetY.value = savedY.value + event.translationY;
		})
		.onEnd(() => {
			savedX.value = offsetX.value;
			savedY.value = offsetY.value;
		});
	const pinch = Gesture.Pinch()
		.onUpdate((event) => {
			// Inline clamp: this runs as a UI-thread worklet.
			scale.value = Math.min(Math.max(savedScale.value * event.scale, minimumScale), maximumScale);
		})
		.onEnd(() => {
			savedScale.value = scale.value;
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
					onPress={() => fit(viewport, true)}
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
