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
        // Optional arguments to be added to the Umami script tag, 
        // as specified in Umami documentation, see
        // https://umami.is/docs/tracker-configuration
        // extraDataAttributes: {
        //     'data-host-url': 'http://stats.mywebsite.com',
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

## API Reference

### `VueUmamiPlugin(options)`

Initialises the Umami tracking plugin with specified options.

- **Parameters**
    - `options` (Object):
        - `websiteID` (String): The Umami website ID required for tracking.
        - `scriptSrc` (String, optional): Custom URL for the Umami script source, default: `https://us.umami.is/script.js`
        - `router` (Router, optional): The Vue Router instance for automatic page tracking.
        - `allowLocalhost` (Boolean, optional): Whether to allow tracking on localhost, default: `false`
        - `extraDataAttributes` (Object, optional): Additional attributes to apply to the injected Umami `<script>` element (typically `data-*` attributes). These are applied after the default attributes; `data-auto-track` defaults to `"false"` but can be overridden here, while `data-website-id` is always taken from `websiteID` and cannot be overridden. Defaults to `{}`.

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
