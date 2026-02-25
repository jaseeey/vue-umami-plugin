import type { RouteLocationNormalized, Router } from 'vue-router';

type UmamiPluginOptions = {
    websiteID: string;
    scriptSrc?: string;
    router?: Router;
    allowLocalhost?: boolean;
    extraDataAttributes?: Record<string, string>;
}

type UmamiTrackEvent = string;

type UmamiTrackEventParams = object;

type UmamiTrackSessionIdentifier = string;

type UmamiTrackSessionData = Record<string, unknown>;

type UmamiTrackPageViewOptions = {
    website: string;
    hostname?: string;
    language?: string;
    referrer?: string;
    screen?: string;
    title?: string;
    url?: string;
}

type UmamiPluginQueuedEvent = {
    kind: 'track',
    event: UmamiTrackEvent,
    args: [ UmamiTrackEventParams? ]
} | {
    kind: 'identify',
    args: [ UmamiTrackSessionIdentifier | UmamiTrackSessionData, UmamiTrackSessionData? ]
} | ((props: UmamiTrackPageViewOptions) => UmamiTrackPageViewOptions);

const PROTECTED_DATA_ATTRIBUTES: ReadonlySet<string> = new Set([
    'data-website-id'
]);

const queuedEvents: UmamiPluginQueuedEvent[] = [];

export function VueUmamiPlugin(options: UmamiPluginOptions): { install: () => void; } {
    return {
        install: () => {
            if (window.location.hostname.includes('localhost') && !options.allowLocalhost) {
                console.warn('Umami plugin not installed due to being on localhost.');
                return;
            }
            const { scriptSrc = 'https://us.umami.is/script.js', websiteID, router, extraDataAttributes = {} }: UmamiPluginOptions = options;
            if (!websiteID) {
                return console.warn('Website ID not provided for Umami plugin, skipping.');
            }
            if (router) {
                attachUmamiToRouter(router);
            }
            onDocumentReady(() => initUmamiScript(scriptSrc, websiteID, extraDataAttributes));
        }
    };
}

function attachUmamiToRouter(router: Router): void {
    router.afterEach((to: RouteLocationNormalized): void => trackUmamiPageView({ url: to.fullPath }));
}

function onDocumentReady(callback: () => void): void {
    document.readyState !== 'loading'
        ? callback()
        : document.addEventListener('DOMContentLoaded', callback);
}

function initUmamiScript(scriptSrc: string, websiteID: string, extraDataAttributes: Record<string, string>): void {
    const script: HTMLScriptElement = document.createElement('script');
    script.defer = true;
    script.src = scriptSrc;
    script.onload = (): void => {
        console.log('Umami plugin loaded');
        processQueuedEvents();
    };
    script.setAttribute('data-website-id', websiteID);
    script.setAttribute('data-auto-track', 'false');
    if (extraDataAttributes) {
        for (const [ key, value ] of Object.entries(extraDataAttributes)) {
            if (PROTECTED_DATA_ATTRIBUTES.has(key) || !key.startsWith('data-')) {
                continue;
            }
            script.setAttribute(key, value);
        }
    }
    document.head.appendChild(script);
}

function processQueuedEvents(): void {
    while (queuedEvents.length) {
        const item: UmamiPluginQueuedEvent | undefined = queuedEvents.shift();
        if (!item) {
            continue;
        }
        typeof item === 'function'
            ? window.umami.track(item)
            : item.kind === 'identify'
                ? typeof item.args[0] === 'string'
                    ? window.umami.identify(item.args[0], item.args[1])
                    : window.umami.identify(item.args[0])
                : window.umami.track(item.event, item.args[0]);
    }
}

export function trackUmamiPageView(options?: Partial<UmamiTrackPageViewOptions>): void {
    const trackPageViewOptionsFn = (props: UmamiTrackPageViewOptions): UmamiTrackPageViewOptions => {
        return { ...props, ...options };
    };
    window.umami
        ? window.umami.track(trackPageViewOptionsFn)
        : queuedEvents.push(trackPageViewOptionsFn);
}

export function trackUmamiEvent(event: UmamiTrackEvent, eventParams?: UmamiTrackEventParams): void {
    window.umami
        ? window.umami.track(event, eventParams)
        : queuedEvents.push({ kind: 'track', event, args: [ eventParams ] });
}

export function identifyUmamiSession(sessionData: UmamiTrackSessionData): void;
export function identifyUmamiSession(id: UmamiTrackSessionIdentifier, sessionData?: UmamiTrackSessionData): void;
export function identifyUmamiSession(idOrSessionData: UmamiTrackSessionIdentifier | UmamiTrackSessionData, sessionData?: UmamiTrackSessionData): void {
    if (typeof idOrSessionData === 'string') {
        window.umami
            ? window.umami.identify(idOrSessionData, sessionData)
            : queuedEvents.push({ kind: 'identify', args: [ idOrSessionData, sessionData ] });
        return;
    }
    window.umami
        ? window.umami.identify(idOrSessionData)
        : queuedEvents.push({ kind: 'identify', args: [ idOrSessionData ] });
}
