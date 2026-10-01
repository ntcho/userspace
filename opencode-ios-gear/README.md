# OpenCode iOS fixes for Gear

Userscript for running the OpenCode web UI in Gear on iOS.

## What it does

- Prevents iOS input auto-zoom by forcing editable controls to 16px before focus.
- Keeps Gear itself at 100% browser zoom while rendering OpenCode at 80% UI density.
- Resizes the OpenCode root to the live visual viewport when the software keyboard opens.
- Compensates for iOS/WKWebView keyboard-induced visual viewport panning.
- Suppresses iOS tap highlighting.

## Target

The script is configured for:

```text
http://100.100.10.1:4096/*
```

That address is only reachable inside the corresponding Tailscale network.

## Install / update

Install [`opencode-ios-gear.user.js`](./opencode-ios-gear.user.js) in Gear's userscript manager.

The userscript includes `@updateURL` and `@downloadURL` metadata pointing to the raw file in this repository, so future versions can be fetched with Gear's userscript **Update** action.

## Settings

The primary user-adjustable setting is:

```js
const APP_ZOOM = 0.80;
```

Keep Gear's own page zoom at **100%**.
