export type PreviewBadge = { text: string; color: string };
export type PreviewDetail = { icon: string; label: string; value: string; monospaced?: boolean };

export type RowPreviewCardProps = {
	icon: string;
	iconColor: string;
	iconUrl?: string;
	title: string;
	subtitle?: string;
	badges?: PreviewBadge[];
	details?: PreviewDetail[];
};
