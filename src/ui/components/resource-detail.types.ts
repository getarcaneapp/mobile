export function nonEmptyResourceValue(value?: string | null): string | undefined {
	return value ? value : undefined;
}

export type ResourceMetadataItem = {
	id?: string;
	label: string;
	value: string;
	systemImage: string;
	tint?: string;
	status?: string;
	monospaced?: boolean;
};

export const metadataItemID = (item: ResourceMetadataItem) => item.id ?? item.label;

export const metadataAccessibilityLabel = (item: ResourceMetadataItem) =>
	`${item.label}: ${item.value}${item.status ? `, ${item.status}` : ''}`;

export const adaptiveColumns = (width: number, minimum = 145, spacing = 8) =>
	Math.max(1, Math.floor((width + spacing) / (minimum + spacing)));

export function chunk<T>(items: T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
	return rows;
}
