/**
 * Port of `ArcaneLogoTrace` (ArcaneLoadingView.swift): the Arcane logo tracing
 * itself on. Each piece's outline draws in, then its fill seeps in while the
 * outline fades, later pieces starting `stagger` after earlier ones. When
 * `loops`, the finished logo holds, fades, and starts over. Drawn with
 * react-native-svg and driven per frame on the UI thread by Reanimated.
 *
 * Standalone (RN view, both platforms). Embed in SwiftUI with `RNHostView`.
 */
import { useEffect } from 'react';
import Animated, {
	useAnimatedProps,
	useFrameCallback,
	useSharedValue,
	type SharedValue
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { withOpacity } from '@/theme/colors';

import { ArcaneLogoPaths, type ArcaneLogoPiece } from './arcane-logo-paths';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export const LogoTrace = {
	pieceDuration: 1.1,
	stagger: 0.045,
	holdDuration: 0.6,
	fadeDuration: 0.45,
	restDuration: 0.25,
	duration(pieceCount: number) {
		return this.pieceDuration + this.stagger * Math.max(pieceCount - 1, 0);
	},
	cycleDuration(pieceCount: number) {
		return this.duration(pieceCount) + this.holdDuration + this.fadeDuration + this.restDuration;
	}
};

const pieceCount = ArcaneLogoPaths.pieces.length;
const traceDuration = LogoTrace.duration(pieceCount);
const cycleDuration = LogoTrace.cycleDuration(pieceCount);
const fadeStart = traceDuration + LogoTrace.holdDuration;

/** Outline finishes at the halfway point; the fill seeps in over the second half. */
function fillOpacity(progress: number) {
	'worklet';
	if (progress < 0.5) return 0;
	if (progress < 0.62) return ((progress - 0.5) / 0.12) * 0.35;
	if (progress < 0.88) return 0.35 + ((progress - 0.62) / 0.26) * 0.65;
	return 1;
}

function strokeOpacity(progress: number) {
	'worklet';
	if (progress < 0.62) return 1;
	if (progress < 0.88) return 1 - ((progress - 0.62) / 0.26) * 0.4;
	return 0.6 - ((progress - 0.88) / 0.12) * 0.6;
}

/** Fast start, long settle. */
function ease(x: number) {
	'worklet';
	return 1 - Math.pow(1 - x, 2.6);
}

/** Loop-local time, or -1 while the looping logo is in its rest gap. */
function loopTime(time: number, loops: boolean) {
	'worklet';
	if (!loops || time <= 0) return time;
	const local = time % cycleDuration;
	return local >= fadeStart + LogoTrace.fadeDuration ? -1 : local;
}

/**
 * A clock in seconds for the trace. `"shared"` follows one app-wide clock so
 * every looping loader stays in step (Swift used the reference date);
 * `"elapsed"` starts at the first drawn frame, minus `delay`.
 */
export function useTraceClock(
	mode: 'shared' | 'elapsed',
	delay = 0,
	isActive = true
): SharedValue<number> {
	const time = useSharedValue(-delay);
	const callback = useFrameCallback((frame) => {
		time.value =
			mode === 'shared' ? frame.timestamp / 1000 : (frame.timeSinceFirstFrame ?? 0) / 1000 - delay;
	}, false);
	useEffect(() => {
		callback.setActive(isActive);
		return () => callback.setActive(false);
	}, [callback, isActive]);
	return time;
}

function TracePiece({
	piece,
	time,
	loops,
	accent,
	strokeWidth
}: {
	piece: ArcaneLogoPiece;
	time: SharedValue<number>;
	loops: boolean;
	accent: string;
	strokeWidth: number;
}) {
	const animatedProps = useAnimatedProps(() => {
		const t = loopTime(time.value, loops);
		const local = (t - LogoTrace.stagger * piece.order) / LogoTrace.pieceDuration;
		if (t < 0 || local <= 0)
			return { fillOpacity: 0, strokeOpacity: 0, strokeDashoffset: piece.length };
		const progress = ease(Math.min(local, 1));
		const traced = Math.min(progress / 0.5, 1);
		return {
			fillOpacity: fillOpacity(progress),
			strokeOpacity: Math.max(strokeOpacity(progress), 0),
			strokeDashoffset: piece.length * (1 - traced)
		};
	});
	return (
		<AnimatedPath
			d={piece.d}
			fill={accent}
			stroke={accent}
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeDasharray={[piece.length, piece.length]}
			animatedProps={animatedProps}
		/>
	);
}

export type ArcaneLogoTraceProps = {
	/** Rendered width; height follows the logo's aspect ratio. */
	width: number;
	accent: string;
	/** Seconds since the trace began; negative while waiting to start. */
	time: SharedValue<number>;
	loops?: boolean;
	/** Faint silhouette opacity drawn under the trace (0 for none). */
	silhouetteOpacity?: number;
};

export function ArcaneLogoTrace({
	width,
	accent,
	time,
	loops = false,
	silhouetteOpacity = 0
}: ArcaneLogoTraceProps) {
	const height = (width * ArcaneLogoPaths.height) / ArcaneLogoPaths.width;
	const scale = width / ArcaneLogoPaths.width;
	// Keep the outline the same on-screen thickness at any size (in logo units).
	const strokeWidth = (2 / scale) * 0.83;
	const groupProps = useAnimatedProps(() => {
		if (!loops || time.value <= 0) return { opacity: 1 };
		const local = time.value % cycleDuration;
		if (local >= fadeStart + LogoTrace.fadeDuration) return { opacity: 0 };
		if (local > fadeStart) return { opacity: 1 - (local - fadeStart) / LogoTrace.fadeDuration };
		return { opacity: 1 };
	});
	return (
		<Svg
			width={width}
			height={height}
			viewBox={`0 0 ${ArcaneLogoPaths.width} ${ArcaneLogoPaths.height}`}
		>
			<G transform={`translate(${ArcaneLogoPaths.translateX},${ArcaneLogoPaths.translateY})`}>
				{silhouetteOpacity > 0 ? (
					<G>
						{ArcaneLogoPaths.pieces.map((piece) => (
							<Path
								key={`s${piece.order}`}
								d={piece.d}
								fill={withOpacity(accent, silhouetteOpacity)}
							/>
						))}
					</G>
				) : null}
				<AnimatedG animatedProps={groupProps}>
					{ArcaneLogoPaths.pieces.map((piece) => (
						<TracePiece
							key={piece.order}
							piece={piece}
							time={time}
							loops={loops}
							accent={accent}
							strokeWidth={strokeWidth}
						/>
					))}
				</AnimatedG>
			</G>
		</Svg>
	);
}

/** The finished logo as a plain filled drawing. */
export function ArcaneLogoStatic({ width, color }: { width: number; color: string }) {
	const height = (width * ArcaneLogoPaths.height) / ArcaneLogoPaths.width;
	return (
		<Svg
			width={width}
			height={height}
			viewBox={`0 0 ${ArcaneLogoPaths.width} ${ArcaneLogoPaths.height}`}
		>
			<G transform={`translate(${ArcaneLogoPaths.translateX},${ArcaneLogoPaths.translateY})`}>
				{ArcaneLogoPaths.pieces.map((piece) => (
					<Path key={piece.order} d={piece.d} fill={color} />
				))}
			</G>
		</Svg>
	);
}
