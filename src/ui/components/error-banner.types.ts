import { systemColors } from '@/theme/colors';

export type ErrorBannerSeverity = 'error' | 'warning';

export type ErrorBannerProps = {
	message: string;
	severity?: ErrorBannerSeverity;
	retry?: () => void;
};

export const errorBannerTint: Record<ErrorBannerSeverity, string> = {
	error: systemColors.red,
	warning: systemColors.orange
};

export const errorBannerAccessibilityPrefix: Record<ErrorBannerSeverity, string> = {
	error: 'Error: ',
	warning: 'Warning: '
};
