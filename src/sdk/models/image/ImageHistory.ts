import { D } from '../base/decoding';

export interface ImageHistoryItem {
	id: string;
	created: number;
	createdBy: string;
	tags: string[];
	size: number;
	comment: string;
}

export const ImageHistoryItem = {
	make(
		this: void,
		init: Partial<ImageHistoryItem> &
			Pick<ImageHistoryItem, 'id' | 'created' | 'createdBy' | 'size'>
	): ImageHistoryItem {
		return { ...init, tags: init.tags ?? [], comment: init.comment ?? '' };
	},

	decode(this: void, raw: unknown): ImageHistoryItem {
		const o = D.object(raw, 'ImageHistoryItem');
		return {
			id: D.optString(o, 'id') ?? '<missing>',
			created: D.optInt(o, 'created') ?? 0,
			createdBy: D.optString(o, 'createdBy') ?? '',
			tags: D.optArray(o, 'tags', D.str) ?? [],
			size: D.optInt(o, 'size') ?? 0,
			comment: D.optString(o, 'comment') ?? ''
		};
	}
} as const;
