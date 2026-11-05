export interface BundlerStepResult {
    ok: boolean;
    detail?: string;
}

export interface BundlerStep {
    name: string;
    timeoutMs: number;
    run(): Promise<BundlerStepResult>;
}

export interface BundlerTestContextOptions {
    /** Retain the temporary consumer project after the run. */
    keep?: boolean;
    /** Log function used for setup progress output. */
    log?: (message: string) => void;
}

export interface BundlerTestContext {
    keep: boolean;
    /** Directory of the temporary consumer project, or null before setup/after teardown. */
    consumer: string | null;
    /** Versions of the installed tools (vite, esbuild, webpack, typescript). */
    versions: Record<string, string> | null;
    /** Run a binary from the consumer's node_modules. Throws on non-zero exit. */
    run(bin: string, args: string[]): string;
    /** Run a node process in the consumer directory. Returns captured output instead of throwing. */
    runNode(args: string[]): { stdout: string; stderr: string };
    /** Pack the repository, scaffold the consumer, and install tooling. */
    setup(): Promise<void>;
    /** Remove the temporary consumer project unless keep is set. Safe to call twice. */
    teardown(): void;
    /** The test matrix, in execution order. Steps have dependencies, so run them sequentially. */
    steps: BundlerStep[];
}

export function createBundlerTestContext(options?: BundlerTestContextOptions): BundlerTestContext;
