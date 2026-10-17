export type PreviewBadge = { text: string; /** Hex. */ color: string };
export type PreviewDetail = { icon: string; label: string; value: string; monospaced?: boolean };

export type RowPreviewCardProps = {
	icon: string;
	/** Hex. */
	iconColor: string;
	iconUrl?: string;
	title: string;
	subtitle?: string;
	badges?: PreviewBadge[];
	details?: PreviewDetail[];
};
