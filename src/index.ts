import type { RouteLocationNormalized, Router } from 'vue-router';

type UmamiPluginOptions = {
    websiteID: string;
    scriptSrc?: string;
    router?: Router;
    allowLocalhost?: boolean;
    maxQueuedEvents?: number;
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

const PLUGIN_MARKER_ATTRIBUTE = 'data-umami-plugin';

const PROTECTED_DATA_ATTRIBUTES: ReadonlySet<string> = new Set([
    'data-website-id',
    PLUGIN_MARKER_ATTRIBUTE
]);

const DEFAULT_MAX_QUEUED_EVENTS = 100;

const queuedEvents: UmamiPluginQueuedEvent[] = [];
const attachedRouters: WeakSet<Router> = new WeakSet();
let hasWarnedQueueLimit = false;
let maxQueuedEvents = DEFAULT_MAX_QUEUED_EVENTS;

function setMaxQueuedEvents(value?: number): void {
    if (typeof value === 'undefined') {
        maxQueuedEvents = DEFAULT_MAX_QUEUED_EVENTS;
    } else if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
        maxQueuedEvents = Math.floor(value);
    } else {
        console.warn(`Invalid maxQueuedEvents value (${String(value)}); falling back to default of ${DEFAULT_MAX_QUEUED_EVENTS}.`);
        maxQueuedEvents = DEFAULT_MAX_QUEUED_EVENTS;
    }
    hasWarnedQueueLimit = false;
    while (queuedEvents.length > maxQueuedEvents) {
        queuedEvents.shift();
    }
}

function queueEvent(item: UmamiPluginQueuedEvent): void {
    if (queuedEvents.length >= maxQueuedEvents) {
        queuedEvents.shift();
        if (!hasWarnedQueueLimit) {
            console.warn(`Umami queue limit of ${maxQueuedEvents} reached; dropping oldest queued events until tracker is available.`);
            hasWarnedQueueLimit = true;
        }
    }
    queuedEvents.push(item);
}

export function VueUmamiPlugin(options: UmamiPluginOptions): { install: () => void; } {
    return {
        install: () => {
            setMaxQueuedEvents(options.maxQueuedEvents);
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
    if (attachedRouters.has(router)) {
        console.warn('Umami plugin router hook is already attached to this router; skipping duplicate attachment.');
        return;
    }
    attachedRouters.add(router);
    router.afterEach((to: RouteLocationNormalized): void => trackUmamiPageView({ url: to.fullPath }));
}

function onDocumentReady(callback: () => void): void {
    document.readyState !== 'loading'
        ? callback()
        : document.addEventListener('DOMContentLoaded', callback);
}

function initUmamiScript(scriptSrc: string, websiteID: string, extraDataAttributes: Record<string, string>): void {
    if (document.head.querySelector(`script[${PLUGIN_MARKER_ATTRIBUTE}]`)) {
        console.warn('Umami plugin script is already injected; skipping duplicate injection.');
        return;
    }
    const script: HTMLScriptElement = document.createElement('script');
    script.defer = true;
    script.src = scriptSrc;
    script.onload = (): void => {
        console.log('Umami plugin loaded');
        processQueuedEvents();
    };
    script.onerror = (): void => {
        console.warn('Umami plugin script failed to load; removing marker so a later install can retry.');
        script.remove();
    };
    script.setAttribute(PLUGIN_MARKER_ATTRIBUTE, 'true');
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
    hasWarnedQueueLimit = false;
}

export function trackUmamiPageView(options?: Partial<UmamiTrackPageViewOptions>): void {
    const trackPageViewOptionsFn = (props: UmamiTrackPageViewOptions): UmamiTrackPageViewOptions => {
        return { ...props, ...options };
    };
    window.umami
        ? window.umami.track(trackPageViewOptionsFn)
        : queueEvent(trackPageViewOptionsFn);
}

export function trackUmamiEvent(event: UmamiTrackEvent, eventParams?: UmamiTrackEventParams): void {
    window.umami
        ? window.umami.track(event, eventParams)
        : queueEvent({ kind: 'track', event, args: [ eventParams ] });
}

export function identifyUmamiSession(sessionData: UmamiTrackSessionData): void;
export function identifyUmamiSession(id: UmamiTrackSessionIdentifier, sessionData?: UmamiTrackSessionData): void;
export function identifyUmamiSession(idOrSessionData: UmamiTrackSessionIdentifier | UmamiTrackSessionData, sessionData?: UmamiTrackSessionData): void {
    if (typeof idOrSessionData === 'string') {
        window.umami
            ? window.umami.identify(idOrSessionData, sessionData)
            : queueEvent({ kind: 'identify', args: [ idOrSessionData, sessionData ] });
        return;
    }
    window.umami
        ? window.umami.identify(idOrSessionData)
        : queueEvent({ kind: 'identify', args: [ idOrSessionData ] });
}
