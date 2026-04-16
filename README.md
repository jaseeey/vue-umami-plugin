# Vue Umami Plugin

The Vue Umami Plugin integrates Umami analytics by loading the library and injecting it into your application's DOM, allowing you to easily track page views and events.

## Background and Scope

This library was created to reduce duplication and streamline the integration of Umami analytics into a number of my personal Vue projects. Though, I decided to share it with the community in the hope that others may find it useful for similar purposes, either as-is, or as a starting point.

Given its focused nature, the plugin has limitations and may lack functionality available through the official Umami library API.

## Features

- **Automatic Page Tracking:** Automatically track page views through your Vue router.
- **Event Tracking:** Easily track custom events with minimal configuration.
- **Lazy Loading:** The Umami script is loaded only when the document is ready, ensuring minimal impact on performance.
- **Queue System:** Events are queued until the Umami script is loaded, ensuring no events are lost.
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
        // Optional, defaults to false. When true, Umami's built-in
        // auto-tracking handles page views after the script loads;
        // the plugin's router.afterEach hook still covers navigations
        // that occur before the script is ready.
        // autoTrack: false,
        // Optional, defaults to 100 (must be >= 1):
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
        - `router` (Router, optional): The Vue Router instance for automatic page tracking.
        - `allowLocalhost` (Boolean, optional): Whether to allow tracking on localhost, default: `false`
        - `autoTrack` (Boolean, optional): Enables Umami's built-in auto-tracking. When `true`, the injected script receives `data-auto-track="true"` and the plugin's `router.afterEach` hook only forwards navigations that occur before the Umami script finishes loading; after load, Umami's tracker takes over to avoid double-counting. Default: `false`. See [Single-page application tracking](#single-page-application-tracking) for guidance.
        - `maxQueuedEvents` (Number, optional): Maximum number of queued calls kept while `window.umami` is unavailable. Oldest items are dropped when the limit is reached. Default: `100`.
        - `extraDataAttributes` (Object, optional): Additional `data-*` attributes to apply to the injected Umami `<script>` element. These are applied after the default attributes; `data-auto-track` can be overridden here only when `autoTrack` is not explicitly set, while `data-website-id` is always taken from `websiteID` and cannot be overridden. Non-`data-*` keys are ignored. Defaults to `{}`. See [Tracker Configuration](#tracker-configuration) for the supported options and examples.

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

The plugin defaults to `autoTrack: false` so that Vue Router integration (via `router.afterEach`) remains the single source of truth for page views. This is the recommended configuration for most single-page applications.

If you prefer Umami's built-in auto-tracking, consider the tradeoffs:

- **With `createWebHistory` router**: set `autoTrack: true`. Umami's tracker listens to History API events and captures Vue Router navigation automatically once the external script finishes loading. To cover the pre-load window, the plugin still attaches its own `router.afterEach` hook and forwards navigations through the queue; after the script loads the hook becomes a no-op so Umami is the sole source of truth.
- **With `createWebHashHistory` router**: keep `autoTrack: false`. Umami's auto-track does not reliably handle `hashchange` navigation; the plugin's `afterEach` hook is required for accurate coverage.
- **Without a router**: either set `autoTrack: true` and let Umami handle navigation via the History API, or keep `autoTrack: false` and call `trackUmamiPageView()` manually at navigation points.

If you set `autoTrack: true` but still want custom per-route logic (for example, to override `to.fullPath` or filter navigations), the plugin exports `trackUmamiPageView` so you can attach your own `router.afterEach` hook alongside auto-tracking.

**Known edge case:** when `autoTrack: true` is combined with a router and the user is still navigating at the exact moment the Umami script finishes loading, the final pre-load navigation may be recorded twice — once by the queue flush and once by Umami's initial auto-tracked page view. In practice this affects at most one page view per session and only when the last redirect lands on the same URL that Umami captures at load time.

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
