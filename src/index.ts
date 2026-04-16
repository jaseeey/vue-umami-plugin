import type { RouteLocationNormalized, Router } from 'vue-router';

type UmamiPluginOptions = {
    websiteID: string;
    scriptSrc?: string;
    router?: Router;
    allowLocalhost?: boolean;
    autoTrack?: boolean;
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

type UmamiTrackPayload = Partial<UmamiTrackPageViewOptions>;

type UmamiTrackModifier = (props: UmamiTrackPageViewOptions) => UmamiTrackPayload;

type UmamiTracker = {
    track: {
        (): void;
        (payload: UmamiTrackPayload): void;
        (eventName: string, eventData?: object): void;
        (modifier: UmamiTrackModifier): void;
    };
    identify: {
        (sessionData: UmamiTrackSessionData): void;
        (id: string, sessionData?: UmamiTrackSessionData): void;
    };
}

type UmamiPluginQueuedEvent = {
    kind: 'track',
    event: UmamiTrackEvent,
    args: [ UmamiTrackEventParams? ]
} | {
    kind: 'identify',
    args: [ UmamiTrackSessionIdentifier | UmamiTrackSessionData, UmamiTrackSessionData? ]
} | UmamiTrackModifier;

type UmamiRouterAttachmentState = {
    autoTrack: boolean;
}

type ResolvedAutoTrack = {
    value: boolean;
    isProvided: boolean;
    shouldWarnConflict: boolean;
}

declare global {
    interface Window {
        umami?: UmamiTracker;
    }
}

const PLUGIN_MARKER_ATTRIBUTE = 'data-umami-plugin';

const PROTECTED_DATA_ATTRIBUTES: ReadonlySet<string> = new Set([
    'data-website-id',
    PLUGIN_MARKER_ATTRIBUTE
]);

const DEFAULT_MAX_QUEUED_EVENTS = 100;

const queuedEvents: UmamiPluginQueuedEvent[] = [];
const attachedRouters: WeakMap<Router, UmamiRouterAttachmentState> = new WeakMap();
let hasWarnedQueueLimit = false;
let maxQueuedEvents = DEFAULT_MAX_QUEUED_EVENTS;

function setMaxQueuedEvents(value: unknown): void {
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

function resolveAutoTrack(value: unknown): ResolvedAutoTrack {
    if (typeof value === 'boolean') {
        return {
            value,
            isProvided: true,
            shouldWarnConflict: true
        };
    }
    if (value !== undefined) {
        console.warn(`Invalid autoTrack value (${String(value)}); falling back to default of false.`);
        return {
            value: false,
            isProvided: true,
            shouldWarnConflict: false
        };
    }
    return {
        value: false,
        isProvided: false,
        shouldWarnConflict: false
    };
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
            const autoTrack = resolveAutoTrack(options.autoTrack);
            if (!websiteID) {
                return console.warn('Website ID not provided for Umami plugin, skipping.');
            }
            if (router) {
                attachUmamiToRouter(router, autoTrack.value);
            }
            onDocumentReady(() => initUmamiScript(scriptSrc, websiteID, extraDataAttributes, autoTrack));
        }
    };
}

function attachUmamiToRouter(router: Router, autoTrack: boolean): void {
    const existingAttachment: UmamiRouterAttachmentState | undefined = attachedRouters.get(router);
    if (existingAttachment) {
        existingAttachment.autoTrack = autoTrack;
        console.warn('Umami plugin router hook is already attached to this router; reusing the existing hook with the latest configuration.');
        return;
    }
    const attachment: UmamiRouterAttachmentState = { autoTrack };
    attachedRouters.set(router, attachment);
    router.afterEach((to: RouteLocationNormalized): void => {
        if (attachment.autoTrack && window.umami) {
            return;
        }
        trackUmamiPageView({ url: to.fullPath });
    });
}

function onDocumentReady(callback: () => void): void {
    document.readyState !== 'loading'
        ? callback()
        : document.addEventListener('DOMContentLoaded', callback);
}

function initUmamiScript(
    scriptSrc: string,
    websiteID: string,
    extraDataAttributes: Record<string, string>,
    autoTrack: ResolvedAutoTrack
): void {
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
    script.setAttribute('data-auto-track', String(autoTrack.value));
    if (extraDataAttributes) {
        if (autoTrack.shouldWarnConflict && 'data-auto-track' in extraDataAttributes) {
            console.warn('Umami plugin autoTrack option conflicts with extraDataAttributes["data-auto-track"]; the explicit autoTrack option takes precedence.');
        }
        for (const [ key, value ] of Object.entries(extraDataAttributes)) {
            if (PROTECTED_DATA_ATTRIBUTES.has(key) || !key.startsWith('data-')) {
                continue;
            }
            if (autoTrack.isProvided && key === 'data-auto-track') {
                continue;
            }
            script.setAttribute(key, value);
        }
    }
    document.head.appendChild(script);
}

function processQueuedEvents(): void {
    const tracker: UmamiTracker | undefined = window.umami;
    if (!tracker) {
        return;
    }
    while (queuedEvents.length) {
        const item: UmamiPluginQueuedEvent | undefined = queuedEvents.shift();
        if (!item) {
            continue;
        }
        typeof item === 'function'
            ? tracker.track(item)
            : item.kind === 'identify'
                ? typeof item.args[0] === 'string'
                    ? tracker.identify(item.args[0], item.args[1])
                    : tracker.identify(item.args[0])
                : tracker.track(item.event, item.args[0]);
    }
    hasWarnedQueueLimit = false;
}

export function trackUmamiPageView(options?: Partial<UmamiTrackPageViewOptions>): void {
    const trackPageViewOptionsFn: UmamiTrackModifier = (props: UmamiTrackPageViewOptions): UmamiTrackPayload => {
        return { ...props, ...options };
    };
    const tracker: UmamiTracker | undefined = window.umami;
    tracker
        ? tracker.track(trackPageViewOptionsFn)
        : queueEvent(trackPageViewOptionsFn);
}

export function trackUmamiEvent(event: UmamiTrackEvent, eventParams?: UmamiTrackEventParams): void {
    const tracker: UmamiTracker | undefined = window.umami;
    tracker
        ? tracker.track(event, eventParams)
        : queueEvent({ kind: 'track', event, args: [ eventParams ] });
}

export function identifyUmamiSession(sessionData: UmamiTrackSessionData): void;
export function identifyUmamiSession(id: UmamiTrackSessionIdentifier, sessionData?: UmamiTrackSessionData): void;
export function identifyUmamiSession(idOrSessionData: UmamiTrackSessionIdentifier | UmamiTrackSessionData, sessionData?: UmamiTrackSessionData): void {
    const tracker: UmamiTracker | undefined = window.umami;
    if (typeof idOrSessionData === 'string') {
        tracker
            ? tracker.identify(idOrSessionData, sessionData)
            : queueEvent({ kind: 'identify', args: [ idOrSessionData, sessionData ] });
        return;
    }
    tracker
        ? tracker.identify(idOrSessionData)
        : queueEvent({ kind: 'identify', args: [ idOrSessionData ] });
}
