import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBundlerTestContext } from '../scripts/bundler-harness.mjs';

/**
 * Opt-in integration suite for the published package's bundler and
 * type-resolution behavior. Setup packs the repository and npm-installs the
 * latest vite, esbuild, webpack, and typescript into a throwaway consumer,
 * so it requires network access and is skipped unless RUN_BUNDLER_TESTS=1 is
 * set. The same matrix can be run ad hoc via `npm run test:bundlers`.
 */
// The tests tsconfig does not load Node types, so read the flag via a scoped
// globalThis cast instead of `process.env`.
const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const enabled = nodeEnv?.RUN_BUNDLER_TESTS === '1';
const context = createBundlerTestContext();

describe.runIf(enabled)('bundler matrix (RUN_BUNDLER_TESTS=1)', () => {
    beforeAll(async () => {
        await context.setup();
    }, 600_000);

    afterAll(() => {
        context.teardown();
    });

    for (const step of context.steps) {
        it(step.name, { timeout: step.timeoutMs }, async () => {
            const result = await step.run();
            expect(result.ok, result.detail || 'step failed').toBe(true);
        });
    }
});
