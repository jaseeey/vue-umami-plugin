export {};

declare global {
    interface Window {
        umami: {
            track: ((trackOptions: UmamiTrackOptions) => void)
                | ((trackOptions: () => UmamiTrackOptions) => void)
                | ((eventType: string, eventParams?: object) => void);
            identify: ((identifyOptions: UmamiTrackSessionData) => void);
        };
    }
}
