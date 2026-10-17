/** Port of Models/Base/Message.swift. */
import type { JSONValue } from '../../types/json';
import { D } from './decoding';

export interface MessageResponse {
	message: string;
	/** JSON key `activityId`. */
	activityID?: string;
}

export const MessageResponse = {
	decode(this: void, raw: unknown): MessageResponse {
		const o = D.object(raw, 'MessageResponse');
		return {
			message: D.string(o, 'message'),
			activityID: D.optString(o, 'activityId')
		};
	},
	encode(this: void, value: MessageResponse): Record<string, unknown> {
		return { message: value.message, activityId: value.activityID };
	}
} as const;

export interface ErrorResponse {
	error: string;
}

export interface ErrorDetail {
	message?: string;
	location?: string;
	value?: JSONValue;
}

export interface ErrorModel {
	title?: string;
	status?: number;
	detail?: string;
	instance?: string;
	type?: string;
	errors?: ErrorDetail[];
}
