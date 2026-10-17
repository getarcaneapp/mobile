/** Port of Models/Event/Event.swift. */
import type { JSONValue } from '../../types/json';
import type { ISODateString } from '../base/date';

export interface Event {
	id: string;
	type: string;
	severity: string;
	title: string;
	description?: string;
	resourceType?: string;
	resourceId?: string;
	resourceName?: string;
	userId?: string;
	username?: string;
	environmentId?: string;
	metadata?: Record<string, JSONValue>;
	timestamp: ISODateString;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
}

export interface EventSeverityCounts {
	total: number;
	info: number;
	success: number;
	warning: number;
	error: number;
}

export const EventSeverityCounts = {
	/** Swift init defaults: every count defaults to `0`. */
	make(init: Partial<EventSeverityCounts> = {}): EventSeverityCounts {
		return {
			total: init.total ?? 0,
			info: init.info ?? 0,
			success: init.success ?? 0,
			warning: init.warning ?? 0,
			error: init.error ?? 0
		};
	}
} as const;
