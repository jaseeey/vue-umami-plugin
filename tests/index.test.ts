import { beforeEach, describe, expect, it, vi } from 'vitest';
import { identifyUmamiSession, trackUmamiEvent, VueUmamiPlugin } from '../src/index';

describe('VueUmamiPlugin', () => {

    beforeEach(() => {
        document.head.innerHTML = '';
        (window as any).umami = undefined;
    });

    it('injects Umami script with provided extra data-* attributes', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            extraDataAttributes: {
                'data-host-url': 'http://stats.example.com',
                'data-domains': 'example.com,example.org'
            }
        });

        plugin.install();

        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        expect(script?.defer).toBe(true);
        expect(script?.getAttribute('data-website-id')).toBe('test-website-id');
        expect(script?.getAttribute('data-auto-track')).toBe('false');
        expect(script?.getAttribute('data-host-url')).toBe('http://stats.example.com');
        expect(script?.getAttribute('data-domains')).toBe('example.com,example.org');
    });

    it('allows the data-auto-track attribute to be overridden', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            extraDataAttributes: {
                'data-auto-track': 'true'
            }
        });

        plugin.install();

        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-auto-track')).toBe('true');
    });

    it('does not allow extraDataAttributes to override data-website-id', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            extraDataAttributes: {
                'data-website-id': 'should-not-apply'
            }
        });

        plugin.install();

        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-website-id')).toBe('test-website-id');
    });

    it('does not allow extraDataAttributes to specify attributes without the data- prefix', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            extraDataAttributes: {
                'host-url': 'http://stats.no-data-prefix.com',
                'domains': 'alpha.com,beta.org'
            }
        });

        plugin.install();

        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        expect(script?.getAttribute('host-url')).toBeNull();
        expect(script?.getAttribute('domains')).toBeNull();
    });
});

describe('identifyUmamiSession', () => {

    beforeEach(() => {
        document.head.innerHTML = '';
        (window as any).umami = undefined;
    });

    it('calls umami.identify with session data when using one argument', () => {
        const identify = vi.fn();
        (window as any).umami = {
            track: vi.fn(),
            identify
        };
        const sessionData = {
            userId: 'alice',
            name: 'Alice Smith'
        };

        identifyUmamiSession(sessionData);

        expect(identify).toHaveBeenCalledTimes(1);
        expect(identify).toHaveBeenCalledWith(sessionData);
    });

    it('calls umami.identify with id and session data when using two arguments', () => {
        const identify = vi.fn();
        (window as any).umami = {
            track: vi.fn(),
            identify
        };
        const sessionData = {
            name: 'Alice Smith'
        };

        identifyUmamiSession('alice-123', sessionData);

        expect(identify).toHaveBeenCalledTimes(1);
        expect(identify).toHaveBeenCalledWith('alice-123', sessionData);
    });

    it('replays queued identify calls for both signatures when the script loads', () => {
        identifyUmamiSession({
            userId: 'alice',
            name: 'Alice Smith'
        });
        identifyUmamiSession('alice-123', {
            name: 'Alice Smith'
        });

        const identify = vi.fn();
        (window as any).umami = {
            track: vi.fn(),
            identify
        };

        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        });
        plugin.install();

        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        script?.onload?.(new Event('load'));

        expect(identify).toHaveBeenCalledTimes(2);
        expect(identify).toHaveBeenNthCalledWith(1, {
            userId: 'alice',
            name: 'Alice Smith'
        });
        expect(identify).toHaveBeenNthCalledWith(2, 'alice-123', {
            name: 'Alice Smith'
        });
    });
});

describe('queued events', () => {

    beforeEach(() => {
        document.head.innerHTML = '';
        (window as any).umami = undefined;
    });

    it('caps queued events when umami is unavailable to prevent unbounded queue growth', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        });
        plugin.install();

        for (let i = 0; i < 150; i += 1) {
            trackUmamiEvent(`event-${i}`);
        }

        const track = vi.fn();
        (window as any).umami = {
            track,
            identify: vi.fn()
        };

        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        script?.onload?.(new Event('load'));

        expect(track).toHaveBeenCalledTimes(100);
        expect(track).toHaveBeenNthCalledWith(1, 'event-50', undefined);
        expect(track).toHaveBeenNthCalledWith(100, 'event-149', undefined);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Umami queue limit of 100 reached'));
        warn.mockRestore();
    });

    it('uses maxQueuedEvents when configured', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            maxQueuedEvents: 5
        });
        plugin.install();

        for (let i = 0; i < 12; i += 1) {
            trackUmamiEvent(`event-${i}`);
        }

        const track = vi.fn();
        (window as any).umami = {
            track,
            identify: vi.fn()
        };

        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        script?.onload?.(new Event('load'));

        expect(track).toHaveBeenCalledTimes(5);
        expect(track).toHaveBeenNthCalledWith(1, 'event-7', undefined);
        expect(track).toHaveBeenNthCalledWith(5, 'event-11', undefined);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Umami queue limit of 5 reached'));
        warn.mockRestore();
    });

    it('warns and falls back to the default when maxQueuedEvents is invalid', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            maxQueuedEvents: 0
        });
        plugin.install();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid maxQueuedEvents value'));
        warn.mockRestore();
    });

    it('re-emits the overflow warning after a successful flush clears the queue', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            maxQueuedEvents: 2
        });
        plugin.install();

        trackUmamiEvent('event-a');
        trackUmamiEvent('event-b');
        trackUmamiEvent('event-c');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Umami queue limit of 2 reached'));
        const overflowCountBeforeFlush = warn.mock.calls.filter(args => typeof args[0] === 'string' && args[0].includes('Umami queue limit of 2 reached')).length;
        expect(overflowCountBeforeFlush).toBe(1);

        const track = vi.fn();
        (window as any).umami = {
            track,
            identify: vi.fn()
        };
        const script = document.head.querySelector('script[src="https://us.umami.is/script.js"]') as HTMLScriptElement | null;
        script?.onload?.(new Event('load'));
        expect(track).toHaveBeenCalledTimes(2);

        (window as any).umami = undefined;
        trackUmamiEvent('event-d');
        trackUmamiEvent('event-e');
        trackUmamiEvent('event-f');
        const overflowCountAfterFlush = warn.mock.calls.filter(args => typeof args[0] === 'string' && args[0].includes('Umami queue limit of 2 reached')).length;
        expect(overflowCountAfterFlush).toBe(2);

        (window as any).umami = {
            track: vi.fn(),
            identify: vi.fn()
        };
        script?.onload?.(new Event('load'));
        warn.mockRestore();
    });
});

describe('idempotent installation', () => {

    beforeEach(() => {
        document.head.innerHTML = '';
        (window as any).umami = undefined;
    });

    it('injects the Umami script at most once across repeated installs', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        });
        plugin.install();
        plugin.install();

        const scripts = document.head.querySelectorAll('script[data-umami-plugin]');
        expect(scripts.length).toBe(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('already injected'));
        warn.mockRestore();
    });

    it('protects the plugin marker attribute from extraDataAttributes override', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            extraDataAttributes: {
                'data-umami-plugin': 'false'
            }
        });
        plugin.install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script).not.toBeNull();
        expect(script?.getAttribute('data-umami-plugin')).toBe('true');
    });

    it('attaches the router hook at most once per router across repeated installs', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const afterEach = vi.fn();
        const router = { afterEach } as any;

        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            router
        });
        plugin.install();
        plugin.install();

        expect(afterEach).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('already attached'));
        warn.mockRestore();
    });

    it('removes the script marker when the script fails to load so later installs can retry', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true
        });
        plugin.install();

        const firstScript = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(firstScript).not.toBeNull();
        firstScript?.onerror?.(new Event('error'));

        expect(document.head.querySelector('script[data-umami-plugin]')).toBeNull();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed to load'));

        plugin.install();
        const secondScript = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(secondScript).not.toBeNull();
        expect(secondScript).not.toBe(firstScript);
        warn.mockRestore();
    });

    it('attaches separate hooks when installed with distinct routers', () => {
        const afterEachA = vi.fn();
        const afterEachB = vi.fn();
        const routerA = { afterEach: afterEachA } as any;
        const routerB = { afterEach: afterEachB } as any;

        VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            router: routerA
        }).install();
        VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            router: routerB
        }).install();

        expect(afterEachA).toHaveBeenCalledTimes(1);
        expect(afterEachB).toHaveBeenCalledTimes(1);
    });
});

describe('autoTrack option', () => {

    beforeEach(() => {
        document.head.innerHTML = '';
        (window as any).umami = undefined;
    });

    it('sets data-auto-track to "true" when autoTrack is true', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: true
        });
        plugin.install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-auto-track')).toBe('true');
    });

    it('sets data-auto-track to "false" when autoTrack is false', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: false
        });
        plugin.install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-auto-track')).toBe('false');
    });

    it('explicit autoTrack takes precedence over a conflicting extraDataAttributes value and warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: true,
            extraDataAttributes: {
                'data-auto-track': 'false'
            }
        });
        plugin.install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-auto-track')).toBe('true');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('autoTrack option conflicts with extraDataAttributes'));
        warn.mockRestore();
    });

    it('warns and falls back to the default when autoTrack is not a boolean', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: 'yes' as any
        });
        plugin.install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-auto-track')).toBe('false');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid autoTrack value'));
        warn.mockRestore();
    });

    it('forwards pre-load navigations when autoTrack is true and router is provided', () => {
        let routeHandler: ((to: any) => void) | null = null;
        const router = {
            afterEach: (fn: (to: any) => void) => {
                routeHandler = fn;
            }
        } as any;

        VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: true,
            router
        }).install();

        expect(routeHandler).not.toBeNull();
        routeHandler?.({ fullPath: '/dashboard' });

        const track = vi.fn();
        (window as any).umami = {
            track,
            identify: vi.fn()
        };
        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        script?.onload?.(new Event('load'));

        expect(track).toHaveBeenCalledTimes(1);
        const flushedFn = track.mock.calls[0][0];
        const payload = typeof flushedFn === 'function' ? flushedFn({ website: 'test-website-id' }) : flushedFn;
        expect(payload.url).toBe('/dashboard');
    });

    it('does not forward post-load navigations when autoTrack is true', () => {
        let routeHandler: ((to: any) => void) | null = null;
        const router = {
            afterEach: (fn: (to: any) => void) => {
                routeHandler = fn;
            }
        } as any;

        VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: true,
            router
        }).install();

        const track = vi.fn();
        (window as any).umami = {
            track,
            identify: vi.fn()
        };
        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        script?.onload?.(new Event('load'));
        expect(track).toHaveBeenCalledTimes(0);

        routeHandler?.({ fullPath: '/after-load' });
        expect(track).toHaveBeenCalledTimes(0);
    });

    it('attaches router.afterEach when autoTrack is false', () => {
        const afterEach = vi.fn();
        const router = { afterEach } as any;

        VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: false,
            router
        }).install();

        expect(afterEach).toHaveBeenCalledTimes(1);
    });

    it('still applies non-conflicting extraDataAttributes when autoTrack is explicit', () => {
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            autoTrack: true,
            extraDataAttributes: {
                'data-auto-track': 'false',
                'data-domains': 'example.com'
            }
        });
        plugin.install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-auto-track')).toBe('true');
        expect(script?.getAttribute('data-domains')).toBe('example.com');
    });

    it('does not warn about conflicts when autoTrack is omitted and extraDataAttributes overrides data-auto-track', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const plugin = VueUmamiPlugin({
            websiteID: 'test-website-id',
            allowLocalhost: true,
            extraDataAttributes: {
                'data-auto-track': 'true'
            }
        });
        plugin.install();

        const script = document.head.querySelector('script[data-umami-plugin]') as HTMLScriptElement | null;
        expect(script?.getAttribute('data-auto-track')).toBe('true');
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('autoTrack option conflicts'));
        warn.mockRestore();
    });
});
