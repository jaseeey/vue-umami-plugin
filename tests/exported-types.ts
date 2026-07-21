import {
    VueUmamiPlugin,
    type UmamiPluginOptions,
    type UmamiRouteLike,
    type UmamiRouterLike,
    type UmamiTrackEvent,
    type UmamiTrackEventParams,
    type UmamiTrackPageViewOptions,
    type UmamiTrackSessionData,
    type UmamiTrackSessionIdentifier,
    trackUmamiEvent,
    trackUmamiPageView,
    identifyUmamiSession
} from '../src/index';

const router: UmamiRouterLike = {
    afterEach: (_handler: (to: UmamiRouteLike) => void) => undefined
};

const options: UmamiPluginOptions = {
    websiteID: 'test-website-id',
    scriptSrc: 'https://example.com/script.js',
    router,
    allowLocalhost: true,
    autoTrack: false,
    debug: false,
    maxQueuedEvents: 50,
    extraDataAttributes: {
        'data-domains': 'example.com'
    }
};

VueUmamiPlugin(options);

const pageView: Partial<UmamiTrackPageViewOptions> = {
    url: '/about',
    title: 'About'
};
trackUmamiPageView(pageView);

const eventName: UmamiTrackEvent = 'button-click';
const eventParams: UmamiTrackEventParams = { buttonName: 'subscribe' };
trackUmamiEvent(eventName, eventParams);

const sessionData: UmamiTrackSessionData = {
    email: 'alice@example.com'
};
const sessionId: UmamiTrackSessionIdentifier = 'alice-123';
identifyUmamiSession(sessionData);
identifyUmamiSession(sessionId, sessionData);
