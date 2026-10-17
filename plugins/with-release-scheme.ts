// Makes the shared Xcode scheme run and archive the Release configuration.
// Tools that build the scheme without an explicit configuration (Sqim,
// plain xcodebuild) then get an app with the JS bundle embedded instead of
// the Expo dev-client launcher that needs Metro. `pnpm expo run:ios` passes
// `-configuration Debug` explicitly, so local development is unaffected.
import fs from 'node:fs';
import path from 'node:path';

import { withDangerousMod, type ConfigPlugin } from 'expo/config-plugins';

const withReleaseScheme: ConfigPlugin = (config) =>
	withDangerousMod(config, [
		'ios',
		(config) => {
			const root = config.modRequest.platformProjectRoot;
			const schemes = path.join(
				root,
				`${config.modRequest.projectName}.xcodeproj`,
				'xcshareddata',
				'xcschemes'
			);
			if (!fs.existsSync(schemes)) return config;
			for (const file of fs.readdirSync(schemes).filter((name) => name.endsWith('.xcscheme'))) {
				const schemePath = path.join(schemes, file);
				const xml = fs
					.readFileSync(schemePath, 'utf8')
					.replace(/(<LaunchAction\b[^>]*?buildConfiguration = ")Debug(")/, '$1Release$2')
					.replace(/(<ArchiveAction\b[^>]*?buildConfiguration = ")Debug(")/, '$1Release$2');
				fs.writeFileSync(schemePath, xml);
			}
			return config;
		}
	]);

export default withReleaseScheme;
