'use strict';

/**
 * CLI wrapper around the shared bundler test harness (scripts/bundler-harness.mjs).
 *
 * Runs the full matrix (TypeScript type-resolution probes, Vite, esbuild and
 * webpack builds, plus Node runtime smoke tests) against a freshly packed copy
 * of the published package. Fails fast on the first failing step.
 *
 * Usage:
 *   node scripts/test-bundlers.js [--keep]
 *
 * --keep retains the temporary consumer project for manual inspection.
 * The same matrix is available in the vitest suite via RUN_BUNDLER_TESTS=1
 * (see tests/bundlers.test.ts).
 */

async function main() {
    const { createBundlerTestContext } = await import('./bundler-harness.mjs');
    const context = createBundlerTestContext({
        keep: process.argv.includes('--keep'),
        log: (message) => console.log(message)
    });

    let failure = null;
    let executed = 0;
    try {
        await context.setup();
        for (const step of context.steps) {
            const result = await step.run();
            executed += 1;
            console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${step.name}${result.detail ? `  (${result.detail})` : ''}`);
            if (!result.ok) {
                failure = `${step.name}${result.detail ? `: ${result.detail}` : ''}`;
                break;
            }
        }
        if (!failure) {
            console.log('');
            console.log(`Bundler tests: ${context.steps.length}/${context.steps.length} passed`);
            console.log('All bundler tests passed.');
        }
    } catch (error) {
        failure = `run crashed after ${executed} step(s): ${error && error.message ? error.message : error}`;
    } finally {
        context.teardown();
    }

    if (failure) {
        console.log('');
        console.log(`Bundler test failed: ${failure}`);
        process.exit(1);
    }
}

main();
