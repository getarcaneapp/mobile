import type { EnvironmentID } from '../client/environment';
import type { RESTService } from '../http/RESTService';
import {
	ActorDiagnostics,
	DiagnosticsMessage,
	GoroutineProfile,
	ServerLogEntry
} from '../models/diagnostics/Diagnostics';
import { BufferingPolicy } from '../streaming/AsyncQueue';
import { StatsStream } from '../streaming/Streams';

export class DiagnosticsService {
	private readonly rest: RESTService;

	constructor(rest: RESTService) {
		this.rest = rest;
	}

	goroutines(args: { envID?: EnvironmentID } = {}): Promise<GoroutineProfile> {
		return this.rest.get(this.rest.environmentPath(args.envID, 'diagnostics/goroutines'), {
			decode: GoroutineProfile.decode
		});
	}

	snapshotStream(): StatsStream<DiagnosticsMessage> {
		return new StatsStream(
			this.rest.transport,
			'diagnostics/stream',
			[],
			DiagnosticsMessage.decode
		);
	}

	actorsStream(): StatsStream<ActorDiagnostics[]> {
		return new StatsStream(
			this.rest.transport,
			'diagnostics/actors/stream',
			[],
			ActorDiagnostics.decodeList
		);
	}

	logsStream(): StatsStream<ServerLogEntry> {
		return new StatsStream(
			this.rest.transport,
			'diagnostics/logs/stream',
			[],
			ServerLogEntry.decode,
			undefined,
			BufferingPolicy.unbounded
		);
	}
}
