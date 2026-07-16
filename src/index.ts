/**
 * Configuration for {@link VueUmamiPlugin}.
 *
 * `router` is typed as {@link UmamiRouterLike} rather than Vue Router's `Router` so this package never depends on (or
 * pins) a specific `vue-router` version. Any object that matches the structural contract is accepted, including Vue
 * Router instances and test doubles.
 */
export type UmamiPluginOptions = {
    /**
     * Umami website ID applied as `data-website-id` on the script tag. Required by the type. At runtime an empty or
     * missing value skips installation and logs a console warning.
     */
    websiteID: string;
    /**
     * URL of the Umami tracker script (cloud or self-hosted).
     * @defaultValue `https://us.umami.is/script.js`
     */
    scriptSrc?: string;
    /**
     * Optional router used for SPA page-view tracking via `afterEach`. Typically a Vue Router instance; see
     * {@link UmamiRouterLike}. Omit when you track page views manually with {@link trackUmamiPageView} or rely only on
     * Umami's built-in auto-tracking.
     */
    router?: UmamiRouterLike;
    /**
     * When `true`, allow installation when `window.location.hostname` includes the substring `localhost` (for example
     * `localhost` or `app.localhost`). Hostnames such as `127.0.0.1` are not matched by this check. Without this flag
     * the plugin skips install on matching hosts because Umami typically rejects localhost traffic.
     * @defaultValue `false`
     */
    allowLocalhost?: boolean;
    /**
     * When `true`, sets `data-auto-track="true"` for Umami's built-in tracking. When a router is supplied, the plugin
     * continues forwarding every router navigation to avoid missing browser history or hash changes. This can overlap
     * with Umami's built-in tracking, so `false` is recommended when the router is the page-view source. Invalid
     * non-boolean values fall back to `false` and are treated as an explicit option (so they win over
     * `extraDataAttributes['data-auto-track']`).
     * @defaultValue `false`
     */
    autoTrack?: boolean;
    /**
     * When `true`, logs a console message after the tracker script loads successfully. Failed loads always warn
     * regardless of this flag.
     * @defaultValue `false`
     */
    debug?: boolean;
    /**
     * Maximum number of track/identify calls kept while `window.umami` is unavailable. Oldest items are dropped when
     * the limit is reached. Must be a finite number `>= 1`; invalid values fall back to `100`.
     * @defaultValue `100`
     */
    maxQueuedEvents?: number;
    /**
     * Extra `data-*` attributes applied to the injected script after the defaults (for example `data-host-url`,
     * `data-domains`, `data-performance`). `data-website-id` and the plugin marker attribute cannot be overridden.
     * `data-auto-track` can only be set here when {@link UmamiPluginOptions.autoTrack} is not explicitly provided.
     * Non-`data-*` keys are ignored.
     * @defaultValue `{}`
     */
    extraDataAttributes?: Record<string, string>;
}

/**
 * Minimal route shape used for automatic page tracking.
 *
 * Only `fullPath` is read when a navigation is forwarded to Umami.
 */
export type UmamiRouteLike = {
    /** Full path (including query and hash) used as the tracked page URL. */
    fullPath: string;
}

/**
 * Structural router contract for optional SPA page-view tracking.
 *
 * Intentionally not imported from `vue-router`: the plugin only needs `afterEach` and a route with `fullPath`.
 * Structural typing keeps `vue-router` out of this package's dependency graph, avoids peer-dep version conflicts, and
 * still accepts real Vue Router instances because they satisfy this shape.
 */
export type UmamiRouterLike = {
    /**
     * Registers a handler invoked after each navigation. The plugin only requires the `to` argument.
     */
    afterEach: (handler: (to: UmamiRouteLike) => void) => unknown;
}

/** Custom event name passed to Umami's `track` API. */
export type UmamiTrackEvent = string;

/** Optional event payload object for {@link trackUmamiEvent}. */
export type UmamiTrackEventParams = object;

/** Optional session identifier string for {@link identifyUmamiSession}. */
export type UmamiTrackSessionIdentifier = string;

/** Session data object accepted by {@link identifyUmamiSession}. */
export type UmamiTrackSessionData = Record<string, unknown>;

/**
 * Full page-view payload shape accepted by Umami's tracker.
 *
 * Consumers usually pass a partial object of this type to {@link trackUmamiPageView}. Omitted fields keep Umami's
 * defaults for the current page.
 */
export type UmamiTrackPageViewOptions = {
    /** Umami website ID for the page view (normally taken from the script tag). */
    website: string;
    /** Hostname reported with the page view. */
    hostname?: string;
    /** Browser language tag (for example `en-US`). */
    language?: string;
    /** Referring URL, when available. */
    referrer?: string;
    /** Screen resolution string (for example `1920x1080`). */
    screen?: string;
    /** Document title for the page view. */
    title?: string;
    /** Path or URL to record (for example `/checkout` or a full path with query). */
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
const attachedRouters: WeakSet<UmamiRouterLike> = new WeakSet();
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

/**
 * Creates a Vue plugin that injects the Umami tracker script and optionally wires SPA page-view tracking through a
 * router.
 *
 * Installation is idempotent: repeated successful installs keep the existing configuration and log a warning. If the
 * script fails to load, a later `install()` can retry (optionally with updated options). An empty or missing
 * {@link UmamiPluginOptions.websiteID} skips installation with a warning. Tracking is skipped when
 * `window.location.hostname` includes the substring `localhost` unless {@link UmamiPluginOptions.allowLocalhost} is
 * `true`.
 *
 * @param options - Plugin configuration; see {@link UmamiPluginOptions}.
 * @returns A Vue plugin object with an `install` method for `app.use(...)`.
 *
 * @example
 * ```ts
 * import { createApp } from 'vue';
 * import { VueUmamiPlugin } from '@jaseeey/vue-umami-plugin';
 * import router from './router';
 *
 * createApp(App)
 *     .use(VueUmamiPlugin({ websiteID: 'YOUR_ID', router }))
 *     .use(router)
 *     .mount('#app');
 * ```
 */
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
                attachUmamiToRouter(router);
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

function attachUmamiToRouter(router: UmamiRouterLike): void {
    if (attachedRouters.has(router)) {
        console.warn('Umami plugin router hook is already attached to this router; keeping the existing hook.');
        return;
    }
    attachedRouters.add(router);
    router.afterEach((to: UmamiRouteLike): void => trackUmamiPageView({ url: to.fullPath }));
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

/**
 * Tracks a page view, optionally overriding Umami's default payload fields such as `url`, `title`, or `referrer`.
 *
 * Useful when not using a router, or when you need a view outside normal navigation. If the tracker is not loaded yet,
 * the call is queued (subject to {@link UmamiPluginOptions.maxQueuedEvents}).
 *
 * @param options - Partial page-view fields merged onto tracker defaults.
 *
 * @example
 * ```ts
 * trackUmamiPageView({ url: '/checkout', title: 'Checkout' });
 * ```
 */
export function trackUmamiPageView(options?: Partial<UmamiTrackPageViewOptions>): void {
    const trackPageViewOptionsFn: UmamiTrackModifier = (props: UmamiTrackPageViewOptions): UmamiTrackPayload => {
        return { ...props, ...options };
    };
    const tracker: UmamiTracker | undefined = window.umami;
    tracker
        ? tracker.track(trackPageViewOptionsFn)
        : queueEvent(trackPageViewOptionsFn);
}

/**
 * Tracks a named custom event with optional event data.
 *
 * If the tracker is not loaded yet, the call is queued (subject to {@link UmamiPluginOptions.maxQueuedEvents}).
 *
 * @param event - Event name reported to Umami.
 * @param eventParams - Optional structured payload for the event.
 *
 * @example
 * ```ts
 * trackUmamiEvent('button-click', { buttonName: 'subscribe' });
 * ```
 */
export function trackUmamiEvent(event: UmamiTrackEvent, eventParams?: UmamiTrackEventParams): void {
    const tracker: UmamiTracker | undefined = window.umami;
    tracker
        ? tracker.track(event, eventParams)
        : queueEvent({ kind: 'track', event, args: [ eventParams ] });
}

/**
 * Identifies the current Umami session with arbitrary session data.
 *
 * If the tracker is not loaded yet, the call is queued (subject to {@link UmamiPluginOptions.maxQueuedEvents}).
 *
 * @param sessionData - Key/value data associated with the session.
 *
 * @example
 * ```ts
 * identifyUmamiSession({ userId: 'alice', plan: 'pro' });
 * ```
 */
export function identifyUmamiSession(sessionData: UmamiTrackSessionData): void;

/**
 * Identifies the current Umami session with an explicit session id and optional session data.
 *
 * If the tracker is not loaded yet, the call is queued (subject to {@link UmamiPluginOptions.maxQueuedEvents}).
 *
 * @param id - Custom session identifier.
 * @param sessionData - Optional key/value data associated with the session.
 *
 * @example
 * ```ts
 * identifyUmamiSession('alice-123', { email: 'alice@example.com' });
 * ```
 */
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
