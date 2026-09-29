import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, type App } from 'vue';
import type { UmamiPluginOptions } from '../src';

type PluginModule = typeof import('../src');
type MockFn = ReturnType<typeof vi.fn>;

interface MountedApp {
    app: App;
    container: HTMLElement;
}

interface FakeRouter {
    push: (fullPath: string) => void;
    afterEach: (handler: (to: { fullPath: string }) => void) => () => void;
}

function createFakeRouter(): FakeRouter {
    let handler: ((to: { fullPath: string }) => void) | null = null;
    const router: FakeRouter = {
        push(fullPath: string): void {
            if (handler) {
                handler({ fullPath });
            }
        },
        afterEach(onNavigation: (to: { fullPath: string }) => void): () => void {
            handler = onNavigation;
            return () => {
                handler = null;
            };
        }
    };
    return router;
}

async function loadFreshPlugin(): Promise<PluginModule> {
    vi.resetModules();
    return import('../src');
}

function getUmamiScript(): HTMLScriptElement | null {
    return document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
}

function installTrackerMock(): { track: MockFn; identify: MockFn } {
    const track = vi.fn();
    const identify = vi.fn();
    (window as any).umami = { track, identify };
    return { track, identify };
}

function dispatchScriptLoad(script: HTMLScriptElement | null): void {
    expect(script).not.toBeNull();
    if (!script) {
        throw new Error('Expected the Umami script to be injected.');
    }
    script.dispatchEvent(new Event('load'));
}

function invokePageViewModifier(track: MockFn, props: Record<string, unknown>): Record<string, unknown> {
    const call = track.mock.calls[track.mock.calls.length - 1];
    expect(call).toBeTruthy();
    expect(typeof call[0]).toBe('function');
    const modifier = call[0] as (p: Record<string, unknown>) => Record<string, unknown>;
    return modifier(props);
}

let mountedApps: MountedApp[] = [];

const Root = {
    name: 'Root',
    render: () => h('div', { id: 'root-marker' }, 'vue app is alive')
};

function mountVueApp(plugin: PluginModule, options: UmamiPluginOptions): MountedApp {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp(Root);
    app.use(plugin.VueUmamiPlugin(options));
    app.mount(container);
    const mounted: MountedApp = { app, container };
    mountedApps.push(mounted);
    return mounted;
}

describe('Vue app integration', () => {

    beforeEach(() => {
        document.head.innerHTML = '';
        (window as any).umami = undefined;
        mountedApps = [];
    });

    afterEach(() => {
        for (const { app, container } of mountedApps) {
            app.unmount();
            container.remove();
        }
        mountedApps = [];
        vi.restoreAllMocks();
    });

    describe('mounting through a real Vue app', () => {

        it('installs the tracker via app.use and keeps the app rendering', async () => {
            const plugin = await loadFreshPlugin();
            const { container } = mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });

            expect(container.querySelector('#root-marker')?.textContent).toBe('vue app is alive');
            const script = getUmamiScript();
            expect(script).not.toBeNull();
            expect(script?.getAttribute('data-website-id')).toBe('int-website-id');
        });

        it('injects the default tracker script with the website id', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });

            const script = getUmamiScript();
            expect(script?.src).toBe('https://us.umami.is/script.js');
            expect(script?.defer).toBe(true);
            expect(script?.getAttribute('data-website-id')).toBe('int-website-id');
            expect(script?.getAttribute('data-auto-track')).toBe('false');
        });

        it('uses a custom scriptSrc when configured through the app', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, {
                websiteID: 'int-website-id',
                allowLocalhost: true,
                scriptSrc: 'https://stats.example.com/script.js'
            });

            const script = document.head.querySelector(
                'script[src="https://stats.example.com/script.js"]'
            ) as HTMLScriptElement | null;
            expect(script).not.toBeNull();
            expect(script?.getAttribute('data-website-id')).toBe('int-website-id');
        });

        it('skips installation on localhost by default', async () => {
            expect(window.location.hostname).toContain('localhost');
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id' });

            expect(getUmamiScript()).toBeNull();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('localhost'));
        });

        it('installs on localhost when allowLocalhost is enabled', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });

            expect(getUmamiScript()).not.toBeNull();
        });

        it('skips installation with a warning when the website id is empty', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: '', allowLocalhost: true });

            expect(getUmamiScript()).toBeNull();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('Website ID'));
        });
    });

    describe('configuration through app options', () => {

        it('applies extra data-* attributes and ignores non-data attributes', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, {
                websiteID: 'int-website-id',
                allowLocalhost: true,
                extraDataAttributes: {
                    'data-host-url': 'http://stats.example.com',
                    'not-a-data-attribute': 'ignored'
                }
            });

            const script = getUmamiScript();
            expect(script?.getAttribute('data-host-url')).toBe('http://stats.example.com');
            expect(script?.getAttribute('not-a-data-attribute')).toBeNull();
        });

        it('protects data-website-id from extraDataAttributes', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, {
                websiteID: 'int-website-id',
                allowLocalhost: true,
                extraDataAttributes: {
                    'data-website-id': 'override-attempt'
                }
            });

            expect(getUmamiScript()?.getAttribute('data-website-id')).toBe('int-website-id');
        });

        it('enables auto tracking when autoTrack is true', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, autoTrack: true });

            expect(getUmamiScript()?.getAttribute('data-auto-track')).toBe('true');
        });

        it('prefers an explicit autoTrack over a conflicting data attribute and warns', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, {
                websiteID: 'int-website-id',
                allowLocalhost: true,
                autoTrack: false,
                extraDataAttributes: {
                    'data-auto-track': 'true'
                }
            });

            expect(getUmamiScript()?.getAttribute('data-auto-track')).toBe('false');
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('conflict'));
        });

        it('logs a debug message when the tracker loads with debug enabled', async () => {
            const log = vi.spyOn(console, 'log').mockImplementation(() => {});
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, debug: true });

            installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            expect(log).toHaveBeenCalledWith('Umami plugin loaded');
        });
    });

    describe('event delivery through the app', () => {

        it('delivers custom events to the tracker after load', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
            const { track, identify } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            plugin.trackUmamiEvent('button-click', { buttonName: 'subscribe' });

            expect(track).toHaveBeenCalledTimes(1);
            expect(track).toHaveBeenCalledWith('button-click', { buttonName: 'subscribe' });
            expect(identify).not.toHaveBeenCalled();
        });

        it('delivers identify calls in both signatures after load', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
            const { track, identify } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            plugin.identifyUmamiSession({ plan: 'pro' });
            plugin.identifyUmamiSession('alice', { email: 'alice@example.com' });

            expect(identify).toHaveBeenNthCalledWith(1, { plan: 'pro' });
            expect(identify).toHaveBeenNthCalledWith(2, 'alice', { email: 'alice@example.com' });
            expect(track).not.toHaveBeenCalled();
        });

        it('delivers page views as merged payloads after load', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            plugin.trackUmamiPageView({ url: '/checkout', title: 'Checkout' });

            expect(track).toHaveBeenCalledTimes(1);
            const payload = invokePageViewModifier(track, { website: 'int-website-id', hostname: 'localhost' });
            expect(payload.url).toBe('/checkout');
            expect(payload.title).toBe('Checkout');
            expect(payload.website).toBe('int-website-id');
        });

        it('forwards tag and id overrides in page view payloads after load', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            plugin.trackUmamiPageView({ url: '/checkout', tag: 'beta', id: 'sess-9' });

            expect(track).toHaveBeenCalledTimes(1);
            const payload = invokePageViewModifier(track, { website: 'int-website-id', tag: 'default-tag' });
            expect(payload.url).toBe('/checkout');
            expect(payload.tag).toBe('beta');
            expect(payload.id).toBe('sess-9');
            expect(payload.website).toBe('int-website-id');
        });

        it('flushes queued page views with tag and id overrides intact', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });

            plugin.trackUmamiPageView({ url: '/pricing', tag: 'beta', id: 'sess-9' });

            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            expect(track).toHaveBeenCalledTimes(1);
            const payload = invokePageViewModifier(track, { website: 'int-website-id', tag: 'default-tag' });
            expect(payload.url).toBe('/pricing');
            expect(payload.tag).toBe('beta');
            expect(payload.id).toBe('sess-9');
        });

        it('queues events raised after mount and flushes them in order on load', async () => {
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });

            plugin.trackUmamiEvent('first');
            plugin.identifyUmamiSession('sess-1');
            plugin.trackUmamiEvent('second');

            const { track, identify } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            expect(track).toHaveBeenNthCalledWith(1, 'first', undefined);
            expect(track).toHaveBeenNthCalledWith(2, 'second', undefined);
            expect(identify).toHaveBeenNthCalledWith(1, 'sess-1', undefined);
        });

        it('caps the queue at a configured maxQueuedEvents and drops the oldest', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, maxQueuedEvents: 2 });

            plugin.trackUmamiEvent('one');
            plugin.trackUmamiEvent('two');
            plugin.trackUmamiEvent('three');

            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            expect(warn).toHaveBeenCalledWith(expect.stringContaining('queue limit'));
            expect(track).toHaveBeenCalledTimes(2);
            expect(track).toHaveBeenNthCalledWith(1, 'two', undefined);
            expect(track).toHaveBeenNthCalledWith(2, 'three', undefined);
        });

        it('falls back to the default queue cap for an invalid maxQueuedEvents', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, {
                websiteID: 'int-website-id',
                allowLocalhost: true,
                maxQueuedEvents: 'a-lot' as unknown as number
            });

            plugin.trackUmamiEvent('kept');

            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid maxQueuedEvents'));
            expect(track).toHaveBeenCalledWith('kept', undefined);
        });
    });

    describe('router tracking through the app', () => {

        it('tracks page views when the app navigates after load', async () => {
            const plugin = await loadFreshPlugin();
            const router = createFakeRouter();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, router });
            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            router.push('/about');

            expect(track).toHaveBeenCalledTimes(1);
            const payload = invokePageViewModifier(track, { website: 'int-website-id' });
            expect(payload.url).toBe('/about');
        });

        it('forwards pre-load navigations once the tracker loads', async () => {
            const plugin = await loadFreshPlugin();
            const router = createFakeRouter();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, router });

            router.push('/pricing');

            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());

            expect(track).toHaveBeenCalledTimes(1);
            const payload = invokePageViewModifier(track, { website: 'int-website-id' });
            expect(payload.url).toBe('/pricing');
        });

        it('tracks navigation for each router across multiple Vue apps', async () => {
            const plugin = await loadFreshPlugin();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const routerA = createFakeRouter();
            const routerB = createFakeRouter();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, router: routerA });
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, router: routerB });

            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());
            routerA.push('/from-a');
            routerB.push('/from-b');

            expect(track).toHaveBeenCalledTimes(2);
            const payloadA = invokePageViewModifier(track, { website: 'int-website-id' });
            expect([ payloadA.url ]).toEqual([ '/from-b' ]);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('already installed'));
        });

        it('does not double-track a router shared by two Vue apps', async () => {
            const plugin = await loadFreshPlugin();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const sharedRouter = createFakeRouter();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, router: sharedRouter });
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true, router: sharedRouter });

            const { track } = installTrackerMock();
            dispatchScriptLoad(getUmamiScript());
            sharedRouter.push('/once');

            expect(track).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('already attached'));
        });
    });

    describe('lifecycle edge cases through the app', () => {

        it('retries installation after a failed script load', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const plugin = await loadFreshPlugin();
            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
            const script = getUmamiScript();
            expect(script).not.toBeNull();
            if (!script) {
                throw new Error('Expected the Umami script to be injected.');
            }
            script.onerror?.call(script, new Event('error'));

            expect(getUmamiScript()).toBeNull();
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed to load'));

            mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
            const retried = getUmamiScript();
            expect(retried).not.toBeNull();
            if (!retried) {
                throw new Error('Expected the retry to inject a new script.');
            }

            const { track } = installTrackerMock();
            dispatchScriptLoad(retried);
            plugin.trackUmamiEvent('after-retry');

            expect(track).toHaveBeenCalledWith('after-retry', undefined);
        });

        it('keeps the original configuration on a second install while tracking the new router', async () => {
            const plugin = await loadFreshPlugin();
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const routerA = createFakeRouter();
            mountVueApp(plugin, {
                websiteID: 'int-website-id',
                allowLocalhost: true,
                autoTrack: false,
                router: routerA
            });
            const firstScript = getUmamiScript();
            expect(firstScript).not.toBeNull();
            if (!firstScript) {
                throw new Error('Expected the Umami script to be injected.');
            }

            const routerB = createFakeRouter();
            mountVueApp(plugin, {
                websiteID: 'int-website-id',
                allowLocalhost: true,
                autoTrack: true,
                router: routerB
            });

            expect(getUmamiScript()).toBe(firstScript);
            expect(firstScript.getAttribute('data-auto-track')).toBe('false');
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('already installed'));

            const { track } = installTrackerMock();
            dispatchScriptLoad(firstScript);
            routerA.push('/from-a');
            routerB.push('/from-b');

            expect(track).toHaveBeenCalledTimes(2);
        });

        it('treats a second install as pending while the document is still loading', async () => {
            Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
            try {
                const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
                const plugin = await loadFreshPlugin();
                mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
                expect(getUmamiScript()).toBeNull();

                mountVueApp(plugin, { websiteID: 'int-website-id', allowLocalhost: true });
                expect(warn).toHaveBeenCalledWith(expect.stringContaining('already installed or pending'));
                expect(document.head.querySelectorAll('script[data-umami-plugin]').length).toBe(0);

                delete (document as any).readyState;
                document.dispatchEvent(new Event('DOMContentLoaded'));

                expect(document.head.querySelectorAll('script[data-umami-plugin]').length).toBe(1);
            } finally {
                delete (document as any).readyState;
            }
        });
    });

    describe('typed window.umami surface', () => {

        it('exposes the tracker getSession method through the typed global', () => {
            const getSession = vi.fn(() => ({ cache: 'sess-cache-1', website: 'int-website-id' }));
            (window as any).umami = {
                track: vi.fn(),
                identify: vi.fn(),
                getSession
            };

            const session = window.umami?.getSession?.();

            expect(session).toEqual({ cache: 'sess-cache-1', website: 'int-website-id' });
            expect(getSession).toHaveBeenCalledTimes(1);
        });

        it('still accepts a tracker without getSession so existing typings do not break', () => {
            const track = vi.fn();
            const identify = vi.fn();
            const tracker: NonNullable<Window['umami']> = { track, identify };
            (window as any).umami = tracker;

            expect(window.umami?.track).toBe(track);
            expect(window.umami?.identify).toBe(identify);
        });
    });
});
