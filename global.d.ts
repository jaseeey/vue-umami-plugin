export {};

type UmamiTrackOptions = {
    website: string;
    hostname?: string;
    language?: string;
    referrer?: string;
    screen?: string;
    title?: string;
    url?: string;
}

type UmamiTrackSessionData = Record<string, unknown>;

declare global {
    interface Window {
        umami: {
            track: {
                (trackOptions: UmamiTrackOptions): void;
                (trackOptions: (props: UmamiTrackOptions) => UmamiTrackOptions): void;
                (eventType: string, eventParams?: object): void;
            };
            identify: {
                (identifyOptions: UmamiTrackSessionData): void;
                (id: string, identifyOptions?: UmamiTrackSessionData): void;
            };
        };
    }
}
