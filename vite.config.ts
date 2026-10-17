import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite-plus';

const generated = [
	'ios/**',
	'android/**',
	'.expo/**',
	'assets/**',
	'modules/*/ios/**',
	'modules/*/android/**',
	'pnpm-lock.yaml'
];

export default defineConfig({
	resolve: {
		alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
	},
	fmt: {
		useTabs: true,
		singleQuote: true,
		trailingComma: 'none',
		printWidth: 100,
		sortPackageJson: true,
		ignorePatterns: generated
	},
	lint: {
		ignorePatterns: generated,
		jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
		rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
		options: { typeAware: true, typeCheck: true }
	},
	test: {
		include: ['src/**/__tests__/**/*.test.ts'],
		environment: 'node'
	},
	staged: {
		'*': 'vp check --fix'
	}
});
