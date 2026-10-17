import { useStoredString } from '@/core/storage';
import { DashboardTotalsTile } from '@/features/dashboard/dashboard-logic';

import { moveItems } from './use-edit-tabs';

export function useDashboardTilesEditor() {
	const [storedTiles, setStoredTiles] = useStoredString(
		DashboardTotalsTile.preferenceKey,
		DashboardTotalsTile.encode(DashboardTotalsTile.defaults)
	);
	const tiles = DashboardTotalsTile.decode(storedTiles);
	const available = DashboardTotalsTile.allCases.filter((tile) => !tiles.includes(tile));
	const isFull = tiles.length >= DashboardTotalsTile.maximum;

	return {
		tiles,
		available,
		isFull,
		move: (sourceIndices: number[], destination: number) =>
			setStoredTiles(DashboardTotalsTile.encode(moveItems(tiles, sourceIndices, destination))),
		remove: (indices: number[]) => {
			const remaining = tiles.filter((_, i) => !indices.includes(i));
			if (remaining.length === 0) return;
			setStoredTiles(DashboardTotalsTile.encode(remaining));
		},
		add: (tile: DashboardTotalsTile) =>
			setStoredTiles(DashboardTotalsTile.encode([...tiles, tile])),
		reset: () => setStoredTiles(DashboardTotalsTile.encode(DashboardTotalsTile.defaults))
	};
}

export const DashboardTilesCopy = {
	shownFooter: `Up to ${DashboardTotalsTile.maximum} tiles. Drag to reorder.`
} as const;
