import type { ReactNode } from 'react';

export type SwarmStateBadgeProps = { state: string; usesCardStyle?: boolean };

export type SwarmListStateProps = {
	isLoading: boolean;
	isEmpty: boolean;
	errorMessage?: string;
	emptyTitle: string;
	emptySystemImage: string;
	emptyDescription?: string;
	retry: () => void;
	children: ReactNode;
};

export type SwarmKeyValueRowsProps = { pairs: [string, string][] };

export type CopyValueRowProps = { title: string; value: string };
