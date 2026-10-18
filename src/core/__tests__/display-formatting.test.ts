import assert from 'node:assert/strict';
import { describe, it, vi } from 'vite-plus/test';

import { shortDayLabel } from '@/core/date-formatting';
import { formatFileBytes } from '@/core/networking/remote-data-limits';
import { titleCasedWords } from '@/core/title-case';
import { activityCountHeader } from '@/features/activities/activity-display';
import { processExtraText } from '@/features/containers/container-model';
import { StatsText, axisBytes, statsAxisLabel } from '@/features/containers/container-stats-frame';
import { showsAllEnvironmentsCountNote } from '@/features/dashboard/dashboard-logic';
import { byteString, layerTitle } from '@/features/images/image-model';
import { severityLetter } from '@/features/images/security/vulnerability-model';
import { CronExpression } from '@/features/jobs/cron-expression';
import {
	backupDestinationTitle,
	backupStatusTitle
} from '@/features/settings/backups/backup-labels';
import { LogViewerFormatting, logLinePresentation } from '@/stores/log-viewer-store';

vi.mock('@/theme/colors', () => ({
	systemColors: new Proxy({}, { get: (_target, key) => String(key) })
}));

describe('byte formatting', () => {
	it('renders zero as 0 KB', () => {
		assert.equal(formatFileBytes(0), '0 KB');
		assert.equal(byteString(0), '0 KB');
		assert.equal(StatsText.rate(0), '0 KB/s');
		assert.equal(formatFileBytes(9_500_000), '9.5 MB');
	});
});

describe('stats axis labels', () => {
	it('formats CPU as percent', () => {
		assert.equal(statsAxisLabel(0.0002, 0.00005, 'percent'), '0.0002%');
		assert.equal(statsAxisLabel(50, 25, 'percent'), '50%');
	});

	it('formats bytes and rates', () => {
		assert.equal(axisBytes(0), '0 B');
		assert.equal(axisBytes(500), '500 B');
		assert.equal(statsAxisLabel(25_000_000, 25_000_000, 'bytes'), '25 MB');
		assert.equal(statsAxisLabel(1_500, 500, 'bytesPerSecond'), '1.5 KB/s');
	});
});

describe('backup labels', () => {
	it('title-cases status and storage', () => {
		assert.equal(backupStatusTitle('failed'), 'Failed');
		assert.equal(backupStatusTitle(''), 'Unknown');
		assert.equal(backupDestinationTitle('local'), 'Local');
		assert.equal(backupDestinationTitle('s3'), 'S3');
		assert.equal(backupDestinationTitle('local_s3'), 'Local and S3');
	});
});

describe('image history', () => {
	it('labels only empty layers as metadata-only', () => {
		assert.equal(layerTitle({ id: '<missing>', size: 9_500_000 }), 'Filesystem layer');
		assert.equal(layerTitle({ id: 'sha256:abc', size: 0 }), 'Metadata-only layer');
		assert.equal(layerTitle({ id: 'sha256:abc', size: 10 }), 'sha256:abc');
	});
});

describe('cron descriptions', () => {
	it('describes common schedules', () => {
		assert.equal(CronExpression.readable('* * * * *'), 'Every minute');
		assert.equal(CronExpression.readable('0 0 */6 * * *'), 'Every 6 hours');
		assert.equal(CronExpression.readable('0 * * * * *'), 'Every minute');
		assert.equal(CronExpression.readable('*/30 * * * * *'), 'Every 30 seconds');
		assert.equal(CronExpression.readable('0 * * * *'), 'Every hour');
		assert.equal(CronExpression.readable('15 * * * * *'), undefined);
	});
});

describe('short dates', () => {
	it('formats ISO days without shifting time zones', () => {
		const expected = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
			new Date(2026, 9, 17)
		);
		assert.equal(shortDayLabel('2026-10-17'), expected);
		assert.equal(shortDayLabel('not a date'), 'not a date');
	});
});

describe('readable labels', () => {
	it('title-cases event types', () => {
		assert.equal(titleCasedWords('network.delete'), 'Network Delete');
		assert.equal(titleCasedWords('container.start'), 'Container Start');
	});

	it('names process columns', () => {
		assert.equal(processExtraText({ title: '%CPU', value: '0.0' }), 'CPU 0.0%');
		assert.equal(processExtraText({ title: '%MEM', value: '0.0' }), 'Memory 0.0%');
		assert.equal(processExtraText({ title: 'ELAPSED', value: '21:17:50' }), 'Running 21:17:50');
		assert.equal(processExtraText({ title: 'NI', value: '0' }), 'NI 0');
	});

	it('uses a letter for unknown severity', () => {
		assert.equal(severityLetter('UNKNOWN'), 'U');
	});
});

describe('log levels', () => {
	it('treats stderr as a neutral stream', () => {
		const notice = logLinePresentation({ text: '[notice] ready', level: 'stderr' });
		assert.equal(notice.severity, 'standard');
		assert.equal(notice.levelLabel, 'STDERR');
		const failure = logLinePresentation({ text: '[error] boom', level: 'stderr' });
		assert.equal(failure.severity, 'error');
		assert.equal(failure.levelLabel, 'ERROR');
		assert.equal(
			LogViewerFormatting.parsedLevel({ text: 'level=warn x', level: 'stdout' }),
			'warn'
		);
	});
});

describe('count captions', () => {
	it('shows the all-environments note only with several environments', () => {
		assert.equal(showsAllEnvironmentsCountNote(false, 1), false);
		assert.equal(showsAllEnvironmentsCountNote(true, 3), false);
		assert.equal(showsAllEnvironmentsCountNote(false, 2), true);
	});

	it('counts shown activities while filtering', () => {
		assert.deepEqual(
			activityCountHeader({ shownCount: 3, activityCount: 11, hasMore: true, isFiltering: true }),
			{ loadedCount: 3, hasMore: false }
		);
		assert.deepEqual(
			activityCountHeader({ shownCount: 3, activityCount: 11, hasMore: true, isFiltering: false }),
			{ loadedCount: 11, hasMore: true }
		);
	});
});
