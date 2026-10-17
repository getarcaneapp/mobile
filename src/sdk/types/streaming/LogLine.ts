export interface LogLine {
	text: string;
	seq?: number;
	level?: string;
	service?: string;
	timestamp?: string;
}

export interface IdentifiedLogLine {
	id: number;
	line: LogLine;
}
