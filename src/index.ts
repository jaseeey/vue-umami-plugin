/**
 * Configuration for {@link VueUmamiPlugin}.
 *
 * `router` is typed as {@link UmamiRouterLike} rather than Vue Router's
 * `Router` so this package never depends on (or pins) a specific
 * `vue-router` version. Any object that matches the structural contract is
 * accepted, including Vue Router instances and test doubles.
 */
export type UmamiPluginOptions = {
    websiteID: string;
    scriptSrc?: string;
    router?: UmamiRouterLike;
    allowLocalhost?: boolean;
    autoTrack?: boolean;
    debug?: boolean;
    maxQueuedEvents?: number;
    extraDataAttributes?: Record<string, string>;
}

/**
 * Minimal route shape used for automatic page tracking.
 *
 * Only `fullPath` is read when a navigation is forwarded to Umami.
 */
export type UmamiRouteLike = {
    fullPath: string;
}

/**
 * Structural router contract for optional SPA page-view tracking.
 *
 * Intentionally not imported from `vue-router`: the plugin only needs
 * `afterEach` and a route with `fullPath`. Structural typing keeps
 * `vue-router` out of this package's dependency graph, avoids peer-dep
 * version conflicts, and still accepts real Vue Router instances because
 * they satisfy this shape.
 */
export type UmamiRouterLike = {
    afterEach: (handler: (to: UmamiRouteLike) => void) => unknown;
}

export type UmamiTrackEvent = string;

export type UmamiTrackEventParams = object;

export type UmamiTrackSessionIdentifier = string;

export type UmamiTrackSessionData = Record<string, unknown>;

export type UmamiTrackPageViewOptions = {
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

type UmamiInstallState = 'idle' | 'pending' | 'loaded';

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
const PLUGIN_STATE_ATTRIBUTE = 'data-umami-plugin-state';

const PROTECTED_DATA_ATTRIBUTES: ReadonlySet<string> = new Set([
    'data-website-id',
    PLUGIN_MARKER_ATTRIBUTE
]);

const DEFAULT_MAX_QUEUED_EVENTS = 100;

const queuedEvents: UmamiPluginQueuedEvent[] = [];
const attachedRouters: WeakMap<UmamiRouterLike, UmamiRouterAttachmentState> = new WeakMap();
let installState: UmamiInstallState = 'idle';
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

function resolveAutoTrack(value: unknown, extraDataAttributes: Record<string, string> = {}): ResolvedAutoTrack {
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
    if ('data-auto-track' in extraDataAttributes) {
        return {
            value: extraDataAttributes['data-auto-track'] !== 'false',
            isProvided: false,
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
            if (window.location.hostname.includes('localhost') && !options.allowLocalhost) {
                console.warn('Umami plugin not installed due to being on localhost.');
                return;
            }
            const { scriptSrc = 'https://us.umami.is/script.js', websiteID, router, extraDataAttributes = {} }: UmamiPluginOptions = options;
            const autoTrack = resolveAutoTrack(options.autoTrack, extraDataAttributes);
            if (!websiteID) {
                return console.warn('Website ID not provided for Umami plugin, skipping.');
            }
            if (getInstallState() !== 'idle') {
                console.warn('Umami plugin is already installed or pending installation; keeping the existing configuration.');
                return;
            }
            installState = 'pending';
            setMaxQueuedEvents(options.maxQueuedEvents);
            const debug = options.debug === true;
            if (router) {
                attachUmamiToRouter(router, autoTrack.value);
            }
            onDocumentReady(() => initUmamiScript(scriptSrc, websiteID, extraDataAttributes, autoTrack, debug));
        }
    };
}

function getInstallState(): UmamiInstallState {
    if (installState === 'idle') {
        return installState;
    }
    if (installState === 'pending' && document.readyState === 'loading') {
        return installState;
    }
    if (!document.head.querySelector(`script[${PLUGIN_MARKER_ATTRIBUTE}]`)) {
        installState = 'idle';
    }
    return installState;
}

function attachUmamiToRouter(router: UmamiRouterLike, autoTrack: boolean): void {
    const existingAttachment: UmamiRouterAttachmentState | undefined = attachedRouters.get(router);
    if (existingAttachment) {
        existingAttachment.autoTrack = autoTrack;
        console.warn('Umami plugin router hook is already attached to this router; updating it for retry after a failed load.');
        return;
    }
    const attachment: UmamiRouterAttachmentState = { autoTrack };
    attachedRouters.set(router, attachment);
    router.afterEach((to: UmamiRouteLike): void => {
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
    autoTrack: ResolvedAutoTrack,
    debug: boolean
): void {
    const existingScript = document.head.querySelector(`script[${PLUGIN_MARKER_ATTRIBUTE}]`) as HTMLScriptElement | null;
    if (existingScript) {
        installState = existingScript.getAttribute(PLUGIN_STATE_ATTRIBUTE) === 'loaded' ? 'loaded' : 'pending';
        console.warn('Umami plugin script is already injected; skipping duplicate injection.');
        return;
    }
    const script: HTMLScriptElement = document.createElement('script');
    script.defer = true;
    script.src = scriptSrc;
    script.onload = (): void => {
        script.setAttribute(PLUGIN_STATE_ATTRIBUTE, 'loaded');
        installState = 'loaded';
        if (debug) {
            console.log('Umami plugin loaded');
        }
        processQueuedEvents();
    };
    script.onerror = (): void => {
        installState = 'idle';
        console.warn('Umami plugin script failed to load; removing marker so a later install can retry.');
        script.remove();
    };
    script.setAttribute(PLUGIN_MARKER_ATTRIBUTE, 'true');
    script.setAttribute(PLUGIN_STATE_ATTRIBUTE, 'pending');
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
