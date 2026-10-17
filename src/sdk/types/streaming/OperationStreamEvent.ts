/** Port of Types/Streaming/OperationStreamEvent.swift. */
import { ArcaneError } from '../../errors/ArcaneError';
import { D } from '../../models/base/decoding';
import type { NDJSONStreamTerminalAction } from '../../streaming/NDJSONStream';

export interface OperationStreamEventProgressDetail {
	current?: number;
	total?: number;
}

/**
 * One frame from a finite project or image operation stream.
 *
 * Current servers emit an activity frame first, followed by log or progress
 * frames, then an explicit success or failure frame. The legacy fields remain
 * optional so the same type can consume v1 Docker progress streams.
 */
export interface OperationStreamEvent {
	type?: string;
	/** JSON key `activityId`. */
	activityID?: string;
	log?: string;
	done?: boolean;
	error?: string;
	status?: string;
	id?: string;
	progress?: string;
	progressDetail?: OperationStreamEventProgressDetail;
	stream?: string;
	phase?: string;
	service?: string;
}

export const OperationStreamEvent = {
	decode(this: void, raw: unknown): OperationStreamEvent {
		const o = D.object(raw, 'OperationStreamEvent');
		const detail = D.optNested(o, 'progressDetail', (value) => {
			const p = D.object(value, 'ProgressDetail');
			return { current: D.optNumber(p, 'current'), total: D.optNumber(p, 'total') };
		});
		return {
			type: D.optString(o, 'type'),
			activityID: D.optString(o, 'activityId'),
			log: D.optString(o, 'log'),
			done: D.optBoolean(o, 'done'),
			error: D.optString(o, 'error'),
			status: D.optString(o, 'status'),
			id: D.optString(o, 'id'),
			progress: D.optString(o, 'progress'),
			progressDetail: detail,
			stream: D.optString(o, 'stream'),
			phase: D.optString(o, 'phase'),
			service: D.optString(o, 'service')
		};
	},

	encode(this: void, event: OperationStreamEvent): Record<string, unknown> {
		const { activityID, ...rest } = event;
		return { ...rest, activityId: activityID };
	},

	/** @internal */
	terminalAction(this: void, event: OperationStreamEvent): NDJSONStreamTerminalAction {
		const error = event.error?.trim();
		if (error !== undefined && error !== '') {
			return { kind: 'fail', error: ArcaneError.server('OPERATION_FAILED', error) };
		}
		if (event.done === true) return { kind: 'finish' };
		return { kind: 'continueStreaming' };
	}
} as const;
