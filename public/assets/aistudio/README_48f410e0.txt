Davejoe Interiors brand asset pack

Source: logo supplied by the client.
- davejoe-logo-transparent.png: full wordmark with transparent background; use in app headers, login, splash/loading screens where horizontal space is available.
- davejoe-logo-white.png: full wordmark on white; use where transparency is not supported.
- pwa-192x192.png and pwa-512x512.png: square emblem icons for PWA installation.
- pwa-512x512-maskable.png: padded maskable icon for Android adaptive icon cropping.
- apple-touch-icon.png: iOS home-screen icon.
- favicon-*.png: browser favicon sizes.

Implementation notes:
1. Keep the supplied full wordmark intact; do not redraw, recolor, distort, or crop it in the UI.
2. Use the square emblem assets for PWA/app icons, not the entire horizontal wordmark.
3. Update every logo reference, including login/auth screens, sidebar/header, mobile navigation, loading/splash states, metadata, manifest icons, favicon links, and Apple touch icon.
4. Keep all paths centralized in one brand asset module/config where practical.
5. Check public/manifest.webmanifest (or the project's actual manifest), index.html, and Vite PWA configuration/service worker caching.
6. Clear/update old icon cache and verify fresh install behavior.
