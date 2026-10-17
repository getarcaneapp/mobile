/** Port of Types/Streaming/LogLine.swift. */

export interface LogLine {
	text: string;
	seq?: number;
	level?: string;
	service?: string;
	timestamp?: string;
}

/**
 * A `LogLine` paired with a stable monotonic identifier assigned at receive
 * time, suitable as a React list key. Consumers wrap incoming lines with a
 * `nextID += 1` counter as they arrive.
 */
export interface IdentifiedLogLine {
	id: number;
	line: LogLine;
}
