import { deepEqual } from '@/core/deep-equal';

type ReusableItem = {
	id: string;
	environmentID: string;
	environmentName?: string;
	value: unknown;
};

export function reusingUnchanged<Item extends ReusableItem>(
	previous: readonly Item[],
	next: Item[]
): Item[] {
	if (previous.length === 0) return next;
	const byID = new Map(previous.map((item) => [item.id, item]));
	let same = previous.length === next.length;
	const merged = next.map((item, index) => {
		const old = byID.get(item.id);
		const kept =
			old &&
			old.environmentID === item.environmentID &&
			old.environmentName === item.environmentName &&
			deepEqual(old.value, item.value)
				? old
				: item;
		if (kept !== previous[index]) same = false;
		return kept;
	});
	return same ? (previous as Item[]) : merged;
}
