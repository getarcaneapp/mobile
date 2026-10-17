export type RowIconProps = {
	systemImage: string;
	tint?: string;
	size?: number;
	changeToken?: string;
};

export type TextStyleName =
	| 'largeTitle'
	| 'title'
	| 'title2'
	| 'title3'
	| 'headline'
	| 'subheadline'
	| 'body'
	| 'callout'
	| 'footnote'
	| 'caption'
	| 'caption2';

export const textStyleSize: Record<TextStyleName, number> = {
	largeTitle: 34,
	title: 28,
	title2: 22,
	title3: 20,
	headline: 17,
	subheadline: 15,
	body: 17,
	callout: 16,
	footnote: 13,
	caption: 12,
	caption2: 11
};
