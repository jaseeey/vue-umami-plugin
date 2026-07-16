# Vue Umami Plugin

The Vue Umami Plugin integrates Umami analytics by loading the library and injecting it into your application's DOM, allowing you to easily track page views and events.

## Background and Scope

This library was created to reduce duplication and streamline the integration of Umami analytics into a number of my personal Vue projects. Though, I decided to share it with the community in the hope that others may find it useful for similar purposes, either as-is, or as a starting point.

Given its focused nature, the plugin has limitations and may lack functionality available through the official Umami library API.

## Features

- **Automatic Page Tracking:** Automatically track page views through your Vue router.
- **Event Tracking:** Easily track custom events with minimal configuration.
- **Lazy Loading:** The Umami script is loaded only when the document is ready, ensuring minimal impact on performance.
- **Queue System:** Events are queued until the Umami script is loaded, with the oldest items dropped once the configurable queue limit is reached.
- **Full Tracker Configuration:** Forward any Umami tracker option (custom host, allowed domains, Core Web Vitals performance tracking, and more) to the injected script via `extraDataAttributes`.

## Requirements

- Vue 3.x
- Vue Router (optional, for automatic page tracking)

## Installation

To install and use this plugin, you can include the library via npm:

```bash
npm install @jaseeey/vue-umami-plugin
```

## Module Format Support (ESM + CJS)

This library ships dual builds and uses conditional exports:

- `dist/esm` for ESM consumers
- `dist/cjs` for CommonJS consumers

Consumers should always import from the package root. Runtime/module resolution will select the correct build automatically.

```javascript
import { VueUmamiPlugin, trackUmamiEvent } from '@jaseeey/vue-umami-plugin';
```

```javascript
const { VueUmamiPlugin, trackUmamiEvent } = require('@jaseeey/vue-umami-plugin');
```

Avoid importing from `dist/esm` or `dist/cjs` directly.

## Usage

To use the Vue Umami Plugin in your project, import it and use it within your Vue application setup:

```javascript
import { createApp } from 'vue';
import { VueUmamiPlugin } from '@jaseeey/vue-umami-plugin';
import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(
    VueUmamiPlugin({
        websiteID: 'YOUR_UMAMI_WEBSITE_ID',
        scriptSrc: 'https://us.umami.is/script.js', // Optional
        router,
        // Optional, defaults to false. Keep false with a router so the
        // plugin's router.afterEach hook is the page-view source.
        // Enable true without a router to use Umami's native auto-tracking.
        // autoTrack: false,
        // Optional, defaults to false. When true, logs successful
        // plugin load events to the console.
        // debug: false,
        // Optional, defaults to 100 (must be >= 1):
        // oldest queued events are dropped if the limit is reached
        // maxQueuedEvents: 100,
        // Optionally forward any Umami tracker option to the injected
        // <script> tag. See the "Tracker Configuration" section below and
        // https://docs.umami.is/docs/tracker-configuration
        // extraDataAttributes: {
        //     'data-host-url': 'https://stats.mywebsite.com',
        //     'data-domains': 'mywebsite.com,mywebsite2.com',
        //     ... etc.
        // }
    })
);

app.use(router).mount('#app');
```

### Tracking Events

To track custom events:

```javascript
import { trackUmamiEvent } from '@jaseeey/vue-umami-plugin';

trackUmamiEvent('button-click', { buttonName: 'subscribe' });
```

### Identifying Sessions

```javascript
import { identifyUmamiSession } from '@jaseeey/vue-umami-plugin';

identifyUmamiSession({
    userId: 'alice',
    email: 'alice@example.com',
    name: 'Alice Smith',
});

identifyUmamiSession('alice-123', {
    email: 'alice@example.com',
    name: 'Alice Smith',
});
```

### TypeScript

Plugin and helper types are exported so you can type shared config objects:

```typescript
import {
    VueUmamiPlugin,
    type UmamiPluginOptions,
    type UmamiRouterLike,
} from '@jaseeey/vue-umami-plugin';

const umamiOptions: UmamiPluginOptions = {
    websiteID: 'YOUR_UMAMI_WEBSITE_ID',
    router,
    autoTrack: false,
};

app.use(VueUmamiPlugin(umamiOptions));
```

#### Why `router` uses structural types (`UmamiRouterLike`)

The optional `router` option is typed as `UmamiRouterLike`, not as Vue Router's
`Router` type from the `vue-router` package. That is deliberate:

- **No `vue-router` dependency.** Automatic page tracking is optional. Projects
  that only call `trackUmamiEvent` / `trackUmamiPageView` should not need
  `vue-router` installed for this plugin to typecheck or install cleanly.
- **No version pinning.** Importing `Router` (even as a peer dependency) would
  couple consumers to a specific major range of `vue-router`. Structural typing
  only requires the small surface the plugin actually uses, so Vue Router 4.x
  (and compatible future majors or adapters) keep working without a package
  upgrade solely for types.
- **Honest contract.** At runtime the plugin only calls `router.afterEach` and
  reads `to.fullPath`. The public types describe that contract:

  - `UmamiRouterLike` — object with `afterEach(handler)`
  - `UmamiRouteLike` — object with `fullPath`

  A real Vue Router instance satisfies both, so you pass `router` as usual.
  Test doubles and custom routers that implement the same shape also work.

Using a `vue-router` **peerDependency** would only signal an optional
integration; it would not remove the need for that package to resolve when
publishing or consuming types that re-export `Router`. Structural types avoid
that trade-off for this narrow integration.

## Tracker Configuration

This plugin injects Umami's tracking `<script>` for you. Every option from the
official [Umami tracker configuration](https://docs.umami.is/docs/tracker-configuration)
is supported. Pass it through `extraDataAttributes` and it is applied to the
script tag as-is.

```javascript
app.use(
    VueUmamiPlugin({
        websiteID: 'YOUR_UMAMI_WEBSITE_ID',
        router,
        extraDataAttributes: {
            'data-host-url': 'https://stats.mywebsite.com',
            'data-domains': 'mywebsite.com,mywebsite2.com',
        },
    })
);
```

### Available attributes

The most commonly used options are listed below. See the
[official documentation](https://docs.umami.is/docs/tracker-configuration) for
the complete list.

| Attribute             | Description                                                                                  | Since   |
|-----------------------|----------------------------------------------------------------------------------------------|---------|
| `data-host-url`       | Send tracking data to a custom Umami host instead of where the script is served from.        | v2.0    |
| `data-domains`        | Comma-separated list of domains the tracker is allowed to run on.                             | v2.0    |
| `data-auto-track`     | Enable/disable Umami's built-in automatic tracking. **Defaults to `"false"`** (see below).   | v2.0    |
| `data-tag`            | Group events under a named tag for filtering and A/B testing.                                 | v2.11   |
| `data-exclude-search` | Omit URL search/query parameters from collected URLs.                                         | v2.11   |
| `data-exclude-hash`   | Omit URL hash fragments from collected URLs.                                                  | v2.16   |
| `data-do-not-track`   | Respect the visitor's browser Do Not Track setting.                                           | v2.17   |
| `data-before-send`    | Name of a global function called to inspect, modify, or cancel each payload before it's sent. | v2.18   |
| `data-performance`    | Collect [Core Web Vitals](https://web.dev/articles/vitals) from your visitors' browsers.     | **v3.1** |

> **Note:** Values are always strings, so booleans must be passed as `'true'` or
> `'false'`, e.g. `'data-do-not-track': 'true'`.

### Plugin-specific behaviour

The plugin applies a few rules to the attributes you pass:

- **Only `data-*` keys are applied.** Any key that does not start with `data-`
  is ignored.
- **`data-website-id` cannot be overridden.** It is always derived from the
  `websiteID` option.
- **`data-auto-track` defaults to `"false"`.** The plugin records page views
  itself through Vue Router, so Umami's automatic tracking is turned off to
  avoid duplicates. You can override it (see Performance tracking below).

### Performance tracking (Core Web Vitals)

Since Umami **v3.1**, the tracker can automatically collect
[Core Web Vitals](https://web.dev/articles/vitals) (LCP, CLS, INP, and more)
from your visitors. Enable it with `data-performance`:

```javascript
app.use(
    VueUmamiPlugin({
        websiteID: 'YOUR_UMAMI_WEBSITE_ID',
        // Note: no `router` here (see the caveat below).
        extraDataAttributes: {
            'data-auto-track': 'true',
            'data-performance': 'true',
        },
    })
);
```

> **Important:** Umami only collects Core Web Vitals while its built-in
> automatic tracking is enabled. Because this plugin sets `data-auto-track` to
> `"false"` by default, you must re-enable it with `'data-auto-track': 'true'`
> for performance tracking to work.
>
> With auto-tracking enabled, Umami tracks page views on its own, including SPA
> navigations, via the History API that Vue Router uses. To avoid counting every
> page view twice, **omit the `router` option** and let Umami handle page views
> when you turn auto-tracking on.

### Modifying or filtering payloads (`data-before-send`)

`data-before-send` references the **name of a function on `window`**, which
Umami calls before every request. Return the payload to send it, or a falsy
value to drop it:

```javascript
window.umamiBeforeSend = (type, payload) => {
    // Drop events coming from internal/admin routes.
    if (payload.url?.startsWith('/admin')) {
        return false;
    }
    return payload;
};

app.use(
    VueUmamiPlugin({
        websiteID: 'YOUR_UMAMI_WEBSITE_ID',
        router,
        extraDataAttributes: {
            'data-before-send': 'umamiBeforeSend',
        },
    })
);
```

## API Reference

### `VueUmamiPlugin(options)`

Initializes the Umami tracking plugin with specified options.

- **Parameters**
    - `options` (Object):
        - `websiteID` (String): The Umami website ID required for tracking.
        - `scriptSrc` (String, optional): Custom URL for the Umami script source, default: `https://us.umami.is/script.js`
        - `router` (`UmamiRouterLike`, optional): A router-compatible object that exposes `afterEach` and navigates to routes with `fullPath` (typically a Vue Router instance). Typed structurally so this package does not depend on or pin a `vue-router` version; see [Why `router` uses structural types](#why-router-uses-structural-types-umamirouterlike).
        - `allowLocalhost` (Boolean, optional): Whether to allow tracking on localhost, default: `false`
        - `autoTrack` (Boolean, optional): Enables Umami's built-in auto-tracking by setting `data-auto-track="true"` on the injected script. When a `router` is also provided, the plugin continues to forward every route change so browser history and hash navigation are not missed; native auto-tracking may therefore duplicate History API page views. Default: `false`. See [Single-page application tracking](#single-page-application-tracking) for guidance.
        - `debug` (Boolean, optional): Logs successful plugin load events to the console when set to `true`. Default: `false`.
        - `maxQueuedEvents` (Number, optional): Maximum number of queued calls kept while `window.umami` is unavailable. Oldest items are dropped when the limit is reached. Default: `100`.
        - `extraDataAttributes` (Object, optional): Additional `data-*` attributes to apply to the injected Umami `<script>` element. These are applied after the default attributes; `data-auto-track` can be overridden here only when `autoTrack` is not explicitly set, while `data-website-id` is always taken from `websiteID` and cannot be overridden. Non-`data-*` keys are ignored. Defaults to `{}`. See [Tracker Configuration](#tracker-configuration) for the supported options and examples.

Invalid `autoTrack` values are treated as `false`, and invalid `maxQueuedEvents` values fall back to the default limit of `100`.

Repeated successful installs keep the existing tracker configuration. A later install can attach a different router for another Vue root, but it does not inject a second script or change the first tracker configuration. If the Umami script fails to load, you can call `install()` again to retry with updated options.

### `trackUmamiPageView(options)`

Manually tracks a page view with Umami, useful when you are not using Vue Router or need to trigger a view outside normal navigation.

- **Parameters**
    - `options` (Object, optional): A partial page view payload that can override values such as `url`, `title`, or `referrer`.

### `trackUmamiEvent(event, eventParams)`

Sends a custom tracking event to Umami.

- **Parameters**
    - `event` (String): The name of the event to track.
    - `eventParams` (Object, optional): Additional parameters for the event; typically includes details like page URL or user actions.

### `identifyUmamiSession(sessionData)`
### `identifyUmamiSession(id, sessionData?)`

Identifies a user session with Umami.

- **Parameters**
    - `id` (String, optional): A custom identifier for the session.
    - `sessionData` (Object): The session data to identify.

## Single-page application tracking

The plugin defaults to `autoTrack: false` so Vue Router integration (via `router.afterEach`) remains the single source of truth for page views. This is the recommended configuration for most single-page applications.

If you prefer Umami's built-in auto-tracking, consider the tradeoffs:

- **With a router**: keep `autoTrack: false`. The plugin forwards every `afterEach` navigation, including browser history and hash navigation, so it has complete SPA coverage. If you set `autoTrack: true` as well, the router hook remains active to avoid missed page views, but Umami may also record History API navigation and duplicate those views.
- **Without a router**: either set `autoTrack: true` and let Umami handle navigation via the History API, or keep `autoTrack: false` and call `trackUmamiPageView()` manually at navigation points.

## Build and Packaging

```bash
npm run build
```

Builds both module formats:

- ESM output: `dist/esm`
- CJS output: `dist/cjs`

During build, module-type markers are written to each output directory:

- `dist/esm/package.json` with `{ "type": "module" }`
- `dist/cjs/package.json` with `{ "type": "commonjs" }`

For publishing and local package testing:

```bash
npm run prepack
npm pack
```

`prepack` runs the full build automatically before `npm pack`/`npm publish`, ensuring tarballs always contain fresh ESM + CJS outputs.

## Contributions

You can contribute to this project by submitting a pull request or reporting issues in the issues section of this repository.

## License

This project is licensed under the MIT License, see the [LICENSE](LICENSE) file for details.
