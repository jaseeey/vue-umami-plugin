import { VueUmamiPlugin } from '../src/index';

type DetailedRouteLike = {
    fullPath: string;
    path: string;
    query: Record<string, unknown>;
    params: Record<string, string | string[]>;
    hash: string;
    name: string | symbol | null;
    meta: Record<string, unknown>;
    redirectedFrom?: DetailedRouteLike;
}

type DetailedRouterLike = {
    afterEach: (
        guard: (to: DetailedRouteLike, from: DetailedRouteLike, failure?: unknown) => unknown
    ) => () => void;
}

const router: DetailedRouterLike = {
    afterEach: () => () => undefined
};

VueUmamiPlugin({
    websiteID: 'test-website-id',
    router
});
