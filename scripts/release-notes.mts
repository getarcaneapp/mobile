import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { releaseNoteCategories, releaseNotes } from '../src/release-notes.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(root, 'app.config.ts'), 'utf8');
const version = /MARKETING_VERSION = '([^']+)'/.exec(config)?.[1];

if (!version) {
	console.error('MARKETING_VERSION was not found in app.config.ts.');
	process.exit(1);
}

if (process.argv[2] === 'version') {
	console.log(version);
	process.exit(0);
}

const entry = releaseNotes.find((note) => note.version === version);

if (!entry) {
	console.error(`src/release-notes.ts has no entry for ${version}.`);
	process.exit(1);
}

const badgeLabels = { premium: 'Premium', preview: 'Preview' };

const sections = releaseNoteCategories.flatMap(({ key, title }) => {
	const bullets = entry[key];
	if (!bullets?.length) return [];
	const lines = bullets.map(
		({ text, badge }) => `- ${text}${badge ? ` _(${badgeLabels[badge]})_` : ''}`
	);
	return [`## ${title}\n\n${lines.join('\n')}`];
});

console.log(sections.join('\n\n'));
