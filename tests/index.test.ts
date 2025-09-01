import { beforeEach, describe, expect, it } from 'vitest';
import { VueUmamiPlugin } from '../src/index';

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
