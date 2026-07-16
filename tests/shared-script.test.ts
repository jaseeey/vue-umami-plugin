import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function dispatchScriptLoad(script: HTMLScriptElement | null): void {
    expect(script).not.toBeNull();
    if (!script) {
        throw new Error('Expected the Umami script to exist.');
    }
    script.dispatchEvent(new Event('load'));
}

async function loadFreshPluginModule(): Promise<typeof import('../src/index')> {
    vi.resetModules();
    return import('../src/index');
}

describe('shared Umami script', () => {

    beforeEach(() => {
        document.head.innerHTML = '';
        (window as any).umami = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('flushes a second module queue when the shared script loads', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const firstModule = await loadFreshPluginModule();
        firstModule.VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        }).install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();

        const secondModule = await loadFreshPluginModule();
        secondModule.trackUmamiEvent('from-second-module');
        secondModule.VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        }).install();

        const track = vi.fn();
        (window as any).umami = {
            track,
            identify: vi.fn()
        };
        dispatchScriptLoad(script);

        expect(track).toHaveBeenCalledWith('from-second-module', undefined);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('already injected'));
    });

    it('flushes a second module queue against an already loaded shared script', async () => {
        const firstModule = await loadFreshPluginModule();
        firstModule.VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        }).install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        (window as any).umami = {
            track: vi.fn(),
            identify: vi.fn()
        };
        dispatchScriptLoad(script);
        expect(script?.getAttribute('data-umami-plugin-state')).toBe('loaded');

        (window as any).umami = undefined;
        const secondModule = await loadFreshPluginModule();
        secondModule.trackUmamiEvent('from-second-module');

        const track = vi.fn();
        (window as any).umami = {
            track,
            identify: vi.fn()
        };
        secondModule.VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        }).install();

        expect(track).toHaveBeenCalledWith('from-second-module', undefined);
    });
});
