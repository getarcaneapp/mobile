import { describe, expect, it } from 'vite-plus/test';

import {
	addDetail,
	capMessages,
	maxActivityDetails,
	maxDetailMessages
} from '@/stores/activity-detail-cache';

describe('capMessages', () => {
	it('keeps the most recent messages', () => {
		const messages = Array.from({ length: maxDetailMessages + 10 }, (_, i) => i);
		const capped = capMessages(messages);
		expect(capped).toHaveLength(maxDetailMessages);
		expect(capped[0]).toBe(10);
	});

	it('returns short lists unchanged', () => {
		const messages = [1, 2, 3];
		expect(capMessages(messages)).toBe(messages);
	});
});

describe('addDetail', () => {
	it('evicts the oldest details', () => {
		let details: Record<string, number> = {};
		for (let i = 0; i < maxActivityDetails + 5; i += 1) details = addDetail(details, `k${i}`, i);
		expect(Object.keys(details)).toHaveLength(maxActivityDetails);
		expect(details.k0).toBeUndefined();
		expect(details[`k${maxActivityDetails + 4}`]).toBe(maxActivityDetails + 4);
	});

	it('moves an updated key to most recent', () => {
		let details: Record<string, number> = {};
		for (let i = 0; i < maxActivityDetails; i += 1) details = addDetail(details, `k${i}`, i);
		details = addDetail(details, 'k0', 100);
		details = addDetail(details, 'new', 1);
		expect(details.k0).toBe(100);
		expect(details.k1).toBeUndefined();
	});
});
