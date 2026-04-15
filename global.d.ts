export {};

type UmamiTrackDefaults = {
    website: string;
    hostname?: string;
    language?: string;
    referrer?: string;
    screen?: string;
    title?: string;
    url?: string;
}

type UmamiTrackPayload = Partial<UmamiTrackDefaults>;

type UmamiTrackSessionData = Record<string, unknown>;

declare global {
    interface Window {
        umami: {
            track: {
                (): void;
                (payload: UmamiTrackPayload): void;
                (eventName: string, eventData?: object): void;
                (modifier: (props: UmamiTrackDefaults) => UmamiTrackPayload): void;
            };
            identify: {
                (sessionData: UmamiTrackSessionData): void;
                (id: string, sessionData?: UmamiTrackSessionData): void;
            };
        };
    }
}
