import { systemColors } from '@/theme/colors';

export type StatusTint = string | undefined;

const normalize = (status?: string) => status?.trim().toLowerCase() ?? '';

export function capitalized(text: string): string {
	return text
		.toLowerCase()
		.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export type ResourceStatusBadgeProps = {
	status?: string;
	isLive?: boolean;
	usesCardStyle?: boolean;
	label?: string;
};

export function badgePresentation({ status, isLive, label }: ResourceStatusBadgeProps) {
	const normalized = normalize(status);
	const trimmedLabel = label?.trim();
	const trimmed = status?.trim() ?? '';
	const displayText = trimmedLabel ? trimmedLabel : trimmed ? capitalized(trimmed) : 'Unknown';
	const live = isLive ?? (normalized === 'running' || normalized === 'online');

	let tint: StatusTint;
	let icon: string;
	if (live) {
		tint = systemColors.green;
		icon = 'checkmark.circle.fill';
	} else {
		switch (normalized) {
			case 'running':
			case 'online':
			case 'success':
			case 'completed':
			case 'done':
			case 'healthy':
				tint = systemColors.green;
				icon = 'checkmark.circle.fill';
				break;
			case 'partial':
			case 'partially running':
			case 'starting':
				tint = systemColors.orange;
				icon = 'circle.lefthalf.filled';
				break;
			case 'stopped':
			case 'exited':
			case 'offline':
				tint = systemColors.red;
				icon = 'stop.circle.fill';
				break;
			case 'error':
			case 'failed':
			case 'unhealthy':
				tint = systemColors.red;
				icon = 'exclamationmark.circle.fill';
				break;
			case 'paused':
				tint = systemColors.yellow;
				icon = 'pause.circle.fill';
				break;
			default:
				tint = undefined;
				icon = 'circle.fill';
		}
	}

	const isTransitional = [
		'partial',
		'partially running',
		'starting',
		'restarting',
		'removing',
		'creating'
	].includes(normalized);

	return { displayText, live, tint, icon, isTransitional, animationKey: `${normalized}|${live}` };
}

export function statusIconPresentation(status?: string, isLive?: boolean) {
	const normalized = normalize(status);
	const live = isLive ?? (normalized === 'running' || normalized === 'online');
	const make = (icon: string, color: StatusTint, label: string) => ({
		icon,
		color,
		label,
		animationKey: `${normalized}|${live}`
	});
	if (live) return make('play.circle.fill', systemColors.green, 'Running');
	switch (normalized) {
		case 'running':
		case 'online':
		case 'success':
		case 'completed':
		case 'done':
			return make('play.circle.fill', systemColors.green, 'Running');
		case 'healthy':
			return make('checkmark.circle.fill', systemColors.green, 'Healthy');
		case 'starting':
			return make('circle.lefthalf.filled', systemColors.orange, 'Starting');
		case 'partial':
		case 'partially running':
			return make('pause.circle.fill', systemColors.yellow, 'Partially running');
		case 'paused':
			return make('pause.circle.fill', systemColors.yellow, 'Paused');
		case 'stopped':
		case 'exited':
		case 'offline':
			return make('stop.circle.fill', systemColors.red, 'Stopped');
		case 'error':
		case 'failed':
		case 'unhealthy':
		case 'dead':
			return make('exclamationmark.circle.fill', systemColors.red, 'Error');
		default:
			return make('circle.fill', undefined, status ? capitalized(status) : 'Unknown');
	}
}

export function environmentStatusTint(status?: string): StatusTint {
	switch (normalize(status)) {
		case 'online':
		case 'running':
		case 'healthy':
			return systemColors.green;
		case 'partial':
		case 'partially running':
		case 'starting':
			return systemColors.orange;
		case 'offline':
		case 'stopped':
		case 'error':
		case 'failed':
		case 'unhealthy':
			return systemColors.red;
		default:
			return undefined;
	}
}
