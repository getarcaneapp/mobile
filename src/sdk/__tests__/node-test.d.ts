// Minimal typings for the Node built-ins the SDK tests use, so the app's
// `tsc` passes without adding @types/node to the React Native project.
declare module 'node:test' {
	type Body = () => void | Promise<void>;
	export function describe(name: string, fn: Body): void;
	export function it(name: string, fn: Body): void;
	export function test(name: string, fn: Body): void;
}

declare module 'node:assert/strict' {
	type ErrorMatcher =
		| RegExp
		| ((error: unknown) => boolean)
		| (new (...args: never[]) => unknown)
		| object;
	interface Assert {
		(value: unknown, message?: string): asserts value;
		ok(value: unknown, message?: string): asserts value;
		equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
		notEqual(actual: unknown, expected: unknown, message?: string): void;
		deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
		match(value: string, pattern: RegExp, message?: string): void;
		throws(fn: () => unknown, matcher?: ErrorMatcher, message?: string): void;
		rejects(
			promise: Promise<unknown> | (() => Promise<unknown>),
			matcher?: ErrorMatcher,
			message?: string
		): Promise<void>;
	}
	const assert: Assert;
	export default assert;
}
