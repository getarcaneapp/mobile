import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vite-plus/test';

describe('native target sources', () => {
	it('keeps the shared Shortcuts model identical in both extensions', () => {
		assert.equal(
			readFileSync('targets/widgets/ArcaneShortcutsModel.swift', 'utf8'),
			readFileSync('targets/intents/ArcaneShortcutsModel.swift', 'utf8')
		);
	});

	it('keeps the Live Activity attributes identical in the app and widgets', () => {
		assert.equal(
			readFileSync('targets/widgets/DeployActivityAttributes.swift', 'utf8'),
			readFileSync('modules/arcane-widget-bridge/ios/DeployActivityAttributes.swift', 'utf8')
		);
	});

	it('uses the catalog file name the app writes', () => {
		assert.match(
			readFileSync('targets/intents/ArcaneShortcutsModel.swift', 'utf8'),
			/static let fileName = "shortcut-catalog\.json"/
		);
	});
});
