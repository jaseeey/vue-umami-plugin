import { RouteLocationNormalized, Router } from 'vue-router';

type UmamiPluginOptions = {
    websiteID: string;
    scriptSrc?: string;
    router?: Router;
}

type UmamiPluginQueuedEvent = {
    type: UmamiTrackEvent,
    args: [ UmamiTrackEventParams ]
} | ((props: UmamiTrackPaveViewOptions) => UmamiTrackPaveViewOptions);

type UmamiTrackEvent = string;

type UmamiTrackEventParams = object;

type UmamiTrackPaveViewOptions = {
    website: string;
    hostname?: string;
    language?: string;
    referrer?: string;
    screen?: string;
    title?: string;
    url?: string;
}

const queuedEvents: UmamiPluginQueuedEvent[] = [];

export function VueUmamiPlugin(options: UmamiPluginOptions): { install: () => void; } {
    return {
        install: () => {
            const { scriptSrc = 'https://us.umami.is/script.js', websiteID, router }: UmamiPluginOptions = options;
            if (!websiteID) {
                return console.warn('Website ID not provided for Umami plugin, skipping.');
            }
            if (router) {
                attachUmamiToRouter(router);
            }
            onDocumentReady(() => initUmamiScript(scriptSrc, websiteID));
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

function initUmamiScript(scriptSrc: string, websiteID: string): void {
    const script: HTMLScriptElement = document.createElement('script');
    script.defer = true;
    script.src = scriptSrc;
    script.onload = (): void => {
        console.log('Umami plugin loaded');
        processQueuedEvents();
    };
    script.setAttribute('data-website-id', websiteID);
    script.setAttribute('data-auto-track', 'false');
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
            : window.umami.track(item.type, item.args[0]);
    }
}

export function trackUmamiPageView(options?: Partial<UmamiTrackPaveViewOptions>): void {
    const trackPageViewOptionsFn = (props: UmamiTrackPaveViewOptions): UmamiTrackPaveViewOptions => {
        return { ...props, ...options };
    };
    window.umami
        ? window.umami.track(trackPageViewOptionsFn)
        : queuedEvents.push(trackPageViewOptionsFn);
}

export function trackUmamiEvent(event: UmamiTrackEvent, eventParams: UmamiTrackEventParams): void {
    window.umami
        ? window.umami.track(event, eventParams)
        : queuedEvents.push({ type: event, args: [ eventParams ] });
}
