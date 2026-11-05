/**
 * Bundler and type-resolution test harness for the published package.
 *
 * Packs the repository into a throwaway consumer project (so the actual
 * published artifact, including the prepack build, is what gets tested),
 * installs modern tooling into that consumer, and exposes the test matrix as
 * discrete steps that can be driven by either:
 *   - the CLI wrapper (scripts/test-bundlers.js), or
 *   - the opt-in vitest suite (tests/bundlers.test.ts, RUN_BUNDLER_TESTS=1).
 *
 * Requires network access during setup (the consumer npm install step).
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function typesProbeFile() {
    return `import type { UmamiPluginOptions } from '@jaseeey/vue-umami-plugin';

const good: UmamiPluginOptions = { websiteID: 'abc' };
// Deliberate type error: proves the .d.ts actually loaded.
const bad: UmamiPluginOptions = { websiteID: 42 };

export { good, bad };
`;
}

export function createBundlerTestContext(options = {}) {
    const keep = Boolean(options.keep);
    const log = typeof options.log === 'function' ? options.log : () => {};

    const context = {
        keep,
        consumer: null,
        versions: null,

        run(bin, args) {
            const binPath = path.join(context.consumer, 'node_modules', '.bin', bin);
            const stdout = execFileSync(binPath, args, {
                cwd: context.consumer,
                encoding: 'utf8',
                timeout: 300000
            });
            return String(stdout);
        },

        runNode(args) {
            const base = { cwd: context.consumer, encoding: 'utf8' };
            try {
                const stdout = execFileSync(process.execPath, args, { timeout: 120000, ...base });
                return { stdout: String(stdout), stderr: '' };
            } catch (error) {
                return {
                    stdout: String(error.stdout || ''),
                    stderr: String(error.stderr || '')
                };
            }
        },

        async setup() {
            context.consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-umami-plugin-bundler-test-'));
            log(`Consumer project: ${context.consumer}\n`);

            log('Step 1: packing the repository (runs the full prepack build)...');
            const packOutput = execFileSync('npm', ['pack', '--pack-destination', context.consumer], {
                cwd: root,
                encoding: 'utf8',
                timeout: 600000
            });
            const tarball = path.basename(String(packOutput).trim().split('\n').pop());
            log(`Packed: ${tarball}\n`);

            // Consumer scaffolding.
            const write = (relativePath, content) => {
                const target = path.join(context.consumer, relativePath);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, content, 'utf8');
            };

            write('package.json', `${JSON.stringify({
                name: 'vue-umami-plugin-bundler-test',
                version: '0.0.0',
                private: true
            }, null, 2)}\n`);

            // Vite entry: uses the plugin at runtime and carries a type import,
            // covering the "bundler fails on type imports" scenario.
            write('index.html', '<!doctype html><html><body><div id="app"></div>' +
                '<script type="module" src="/src/main.ts"></script></body></html>\n');
            write('src/main.ts', `import { VueUmamiPlugin, trackUmamiPageView } from '@jaseeey/vue-umami-plugin';
import type { UmamiPluginOptions } from '@jaseeey/vue-umami-plugin';

const options: UmamiPluginOptions = { websiteID: 'test-123' };
console.log('loaded', typeof VueUmamiPlugin, typeof trackUmamiPageView, options.websiteID);
`);

            // Type-resolution probes (one per tsconfig).
            for (const file of ['probe-esm.mts', 'probe-cjs.cts', 'probe-bundler.ts']) {
                write(file, typesProbeFile());
            }
            const baseCompilerOptions = {
                target: 'es2022',
                strict: true,
                noEmit: true,
                skipLibCheck: true
            };
            write('tsconfig.nodenext-esm.json', `${JSON.stringify({
                compilerOptions: { ...baseCompilerOptions, module: 'nodenext', moduleResolution: 'nodenext' },
                files: ['probe-esm.mts']
            }, null, 2)}\n`);
            write('tsconfig.nodenext-cjs.json', `${JSON.stringify({
                compilerOptions: { ...baseCompilerOptions, module: 'nodenext', moduleResolution: 'nodenext' },
                files: ['probe-cjs.cts']
            }, null, 2)}\n`);
            write('tsconfig.bundler.json', `${JSON.stringify({
                compilerOptions: { ...baseCompilerOptions, module: 'esnext', moduleResolution: 'bundler' },
                files: ['probe-bundler.ts']
            }, null, 2)}\n`);

            // Webpack entries.
            write('w-cjs.js', `const m = require('@jaseeey/vue-umami-plugin');\n` +
                `console.log('loaded', typeof m.VueUmamiPlugin, typeof m.trackUmamiPageView);\n`);
            write('w-esm.js', `import { VueUmamiPlugin, trackUmamiPageView } from '@jaseeey/vue-umami-plugin';\n` +
                `console.log('loaded', typeof VueUmamiPlugin, typeof trackUmamiPageView);\n`);

            log('Step 2: installing tooling into the consumer (vite, esbuild, webpack, typescript)...');
            execFileSync('npm', [
                'install',
                '--no-audit',
                '--no-fund',
                'vite',
                'esbuild',
                'webpack',
                'typescript',
                `./${tarball}`
            ], { cwd: context.consumer, encoding: 'utf8', timeout: 600000 });
            const versions = {};
            for (const dep of ['vite', 'esbuild', 'webpack', 'typescript']) {
                versions[dep] = JSON.parse(
                    fs.readFileSync(path.join(context.consumer, 'node_modules', dep, 'package.json'), 'utf8')
                ).version;
            }
            context.versions = versions;
            log(`Installed: ${Object.entries(versions).map(([name, version]) => `${name} ${version}`).join(', ')}\n`);
        },

        teardown() {
            if (!context.consumer) return;
            if (keep) {
                log(`Kept consumer project at: ${context.consumer}`);
            } else {
                fs.rmSync(context.consumer, { recursive: true, force: true });
            }
            context.consumer = null;
        }
    };

    function checkTypes(configPath) {
        const binPath = path.join(context.consumer, 'node_modules', '.bin', 'tsc');
        let stdout = '';
        let stderr = '';
        try {
            stdout = String(execFileSync(binPath, ['-p', path.join(context.consumer, configPath)], {
                cwd: context.consumer,
                encoding: 'utf8'
            }));
        } catch (error) {
            stdout = String(error.stdout || '');
            stderr = String(error.stderr || '');
        }
        const output = `${stdout}\n${stderr}`;
        // The probe contains a deliberate TS2322, so tsc must fail with exactly
        // that error and no resolution errors (TS2307 / TS7016).
        const ok = output.includes('TS2322') && !/TS2307|TS7016/.test(output);
        return {
            ok,
            detail: ok ? 'types loaded (probe error only)' : `unexpected tsc output:\n${output.trim()}`
        };
    }

    async function webpackBuild(key, entry, target) {
        // webpack is CJS and lives in the consumer's node_modules, so resolve
        // it with a require anchored to that directory (ESM import() does not
        // perform CJS directory resolution).
        const requireFromConsumer = createRequire(path.join(context.consumer, 'webpack-build.js'));
        const webpack = requireFromConsumer('webpack');
        await new Promise((resolve, reject) => {
            webpack(
                {
                    mode: 'production',
                    target,
                    context: context.consumer,
                    entry: path.join(context.consumer, entry),
                    output: {
                        path: path.join(context.consumer, `dist-webpack-${key}`),
                        filename: 'bundle.js'
                    },
                    devtool: false
                },
                (err, stats) => {
                    if (err) return reject(err);
                    if (stats.hasErrors()) {
                        return reject(new Error(stats.toString({ errors: true, modules: false })));
                    }
                    resolve();
                }
            );
        });
        const bundle = fs.readFileSync(path.join(context.consumer, `dist-webpack-${key}`, 'bundle.js'), 'utf8');
        return (bundle.match(/umami/g) || []).length;
    }

    const stepTimeout = 120000;
    const runtimeDetail = (result) =>
        `runtime: ${result.stdout.trim().replace(/\n/g, ' ') || result.stderr.trim()}`;

    context.steps = [
        {
            name: 'types nodenext (ESM consumer)',
            timeoutMs: stepTimeout,
            run: async () => checkTypes('tsconfig.nodenext-esm.json')
        },
        {
            name: 'types nodenext (CJS consumer)',
            timeoutMs: stepTimeout,
            run: async () => checkTypes('tsconfig.nodenext-cjs.json')
        },
        {
            name: 'types bundler resolution',
            timeoutMs: stepTimeout,
            run: async () => checkTypes('tsconfig.bundler.json')
        },
        {
            name: 'vite client build',
            timeoutMs: stepTimeout,
            run: async () => {
                context.run('vite', ['build']);
                const assetsDir = path.join(context.consumer, 'dist', 'assets');
                const clientAsset = fs.readdirSync(assetsDir).find((name) => name.endsWith('.js'));
                const bundle = fs.readFileSync(path.join(assetsDir, clientAsset), 'utf8');
                const bundled = Boolean(clientAsset) && bundle.includes('umami');
                return {
                    ok: bundled,
                    detail: `vite ${context.versions.vite}${bundled ? ', plugin code bundled' : ', MISSING plugin code'}`
                };
            }
        },
        {
            name: 'vite SSR build + node runtime',
            timeoutMs: stepTimeout,
            run: async () => {
                context.run('vite', ['build', '--ssr', 'src/main.ts', '--outDir', 'dist-ssr']);
                const result = context.runNode([path.join(context.consumer, 'dist-ssr', 'main.mjs')]);
                return {
                    ok: result.stdout.includes('loaded function function test-123'),
                    detail: runtimeDetail(result)
                };
            }
        },
        {
            name: 'esbuild browser/esm',
            timeoutMs: stepTimeout,
            run: async () => {
                const outPath = path.join(context.consumer, 'bundle-browser.js');
                context.run('esbuild', ['src/main.ts', '--bundle', '--platform=browser', '--format=esm', `--outfile=${outPath}`]);
                const bundle = fs.readFileSync(outPath, 'utf8');
                const bundled = bundle.includes('umami');
                return {
                    ok: bundled,
                    detail: `esbuild ${context.versions.esbuild}${bundled ? ', plugin code bundled' : ', MISSING plugin code'}`
                };
            }
        },
        {
            name: 'esbuild node/cjs',
            timeoutMs: stepTimeout,
            run: async () => {
                const outPath = path.join(context.consumer, 'bundle-node.js');
                context.run('esbuild', ['src/main.ts', '--bundle', '--platform=node', '--format=cjs', `--outfile=${outPath}`]);
                const bundle = fs.readFileSync(outPath, 'utf8');
                const bundled = bundle.includes('umami');
                return {
                    ok: bundled,
                    detail: `esbuild ${context.versions.esbuild}${bundled ? ', plugin code bundled' : ', MISSING plugin code'}`
                };
            }
        },
        {
            name: 'webpack web (CJS entry)',
            timeoutMs: stepTimeout,
            run: async () => {
                const bundled = (await webpackBuild('webpack-web-(CJS-entry)', 'w-cjs.js', 'web')) >= 1;
                return {
                    ok: bundled,
                    detail: `webpack ${context.versions.webpack}${bundled ? ', plugin code bundled' : ', MISSING plugin code'}`
                };
            }
        },
        {
            name: 'webpack node (CJS entry)',
            timeoutMs: stepTimeout,
            run: async () => {
                const bundled = (await webpackBuild('webpack-node-(CJS-entry)', 'w-cjs.js', 'node')) >= 1;
                return {
                    ok: bundled,
                    detail: `webpack ${context.versions.webpack}${bundled ? ', plugin code bundled' : ', MISSING plugin code'}`
                };
            }
        },
        {
            name: 'webpack web (ESM entry)',
            timeoutMs: stepTimeout,
            run: async () => {
                const bundled = (await webpackBuild('webpack-web-(ESM-entry)', 'w-esm.js', 'web')) >= 1;
                return {
                    ok: bundled,
                    detail: `webpack ${context.versions.webpack}${bundled ? ', plugin code bundled' : ', MISSING plugin code'}`
                };
            }
        },
        {
            name: 'webpack node (ESM entry)',
            timeoutMs: stepTimeout,
            run: async () => {
                const bundled = (await webpackBuild('webpack-node-(ESM-entry)', 'w-esm.js', 'node')) >= 1;
                return {
                    ok: bundled,
                    detail: `webpack ${context.versions.webpack}${bundled ? ', plugin code bundled' : ', MISSING plugin code'}`
                };
            }
        },
        {
            name: 'webpack node (CJS entry) runtime',
            timeoutMs: stepTimeout,
            run: async () => {
                const result = context.runNode([
                    path.join(context.consumer, 'dist-webpack-webpack-node-(CJS-entry)', 'bundle.js')
                ]);
                return {
                    ok: result.stdout.includes('loaded function function'),
                    detail: runtimeDetail(result)
                };
            }
        },
        {
            name: 'webpack node (ESM entry) runtime',
            timeoutMs: stepTimeout,
            run: async () => {
                const result = context.runNode([
                    path.join(context.consumer, 'dist-webpack-webpack-node-(ESM-entry)', 'bundle.js')
                ]);
                return {
                    ok: result.stdout.includes('loaded function function'),
                    detail: runtimeDetail(result)
                };
            }
        },
        {
            name: 'node CJS require',
            timeoutMs: stepTimeout,
            run: async () => {
                const result = context.runNode([
                    '-e',
                    `const m = require('@jaseeey/vue-umami-plugin'); console.log('loaded', typeof m.VueUmamiPlugin, typeof m.trackUmamiPageView);`
                ]);
                return {
                    ok: result.stdout.includes('loaded function function'),
                    detail: `runtime: ${result.stdout.trim()}`
                };
            }
        },
        {
            name: 'node ESM import',
            timeoutMs: stepTimeout,
            run: async () => {
                const result = context.runNode([
                    '-e',
                    `import('@jaseeey/vue-umami-plugin').then((m) => console.log('loaded', typeof m.VueUmamiPlugin, typeof m.trackUmamiPageView));`
                ]);
                return {
                    ok: result.stdout.includes('loaded function function'),
                    detail: `runtime: ${result.stdout.trim()}`
                };
            }
        }
    ];

    return context;
}
