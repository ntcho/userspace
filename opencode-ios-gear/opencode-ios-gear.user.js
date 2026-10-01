// ==UserScript==
// @name         OpenCode iOS Fixes for Gear
// @namespace    local.opencode
// @version      1.0.5
// @description  Fix iOS input zoom, keyboard viewport panning, and UI density in Gear
// @include      http://100.100.10.1:4096/*
// @updateURL    https://raw.githubusercontent.com/ntcho/userspace/main/opencode-ios-gear/opencode-ios-gear.user.js
// @downloadURL  https://raw.githubusercontent.com/ntcho/userspace/main/opencode-ios-gear/opencode-ios-gear.user.js
// @homepage     https://github.com/ntcho/userspace/tree/main/opencode-ios-gear
// @run-at       document-start
// @run-in       normal-tabs
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_ZOOM = 0.80;
  const KEYBOARD_THRESHOLD = 150;

  const EDITABLE = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[role="textbox"]'
  ].join(',');

  let closedViewportHeight = 0;
  let lastWidth = -1;
  let lastHeight = -1;
  let lastPan = -1;
  let settleFrame = 0;
  let settleFramesRemaining = 0;

  function findEditable(target) {
    if (!(target instanceof Element)) return null;
    if (target.matches(EDITABLE)) return target;
    return target.closest(EDITABLE);
  }

  function force16px(el) {
    if (!(el instanceof HTMLElement)) return;

    el.style.setProperty('font-size', '16px', 'important');
    el.style.setProperty('-webkit-text-size-adjust', '100%', 'important');
  }

  function prepareEditable(event) {
    const path =
      typeof event.composedPath === 'function'
        ? event.composedPath()
        : [event.target];

    for (const node of path) {
      const editable = findEditable(node);
      if (!editable) continue;

      force16px(editable);
      return;
    }
  }

  function installViewportMeta() {
    if (!document.head) return false;

    let viewport = document.querySelector('meta[name="viewport"]');

    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }

    viewport.content = [
      'width=device-width',
      'initial-scale=1',
      'maximum-scale=1',
      'user-scalable=no',
      'viewport-fit=cover'
    ].join(', ');

    return true;
  }

  function installCSS() {
    if (!document.head || document.getElementById('opencode-ios-fixes')) {
      return false;
    }

    const style = document.createElement('style');
    style.id = 'opencode-ios-fixes';

    style.textContent = `
      input,
      textarea,
      select,
      [contenteditable="true"],
      [contenteditable="plaintext-only"],
      [role="textbox"] {
        font-size: 16px !important;
        -webkit-text-size-adjust: 100% !important;
      }

      * {
        -webkit-tap-highlight-color: transparent !important;
      }

      html {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        overscroll-behavior: none !important;
        -webkit-overflow-scrolling: auto !important;
      }

      body {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: var(--oc-visible-width, 100vw) !important;
        height: var(--oc-visible-height, 100dvh) !important;
        min-width: var(--oc-visible-width, 100vw) !important;
        max-width: var(--oc-visible-width, 100vw) !important;
        min-height: var(--oc-visible-height, 100dvh) !important;
        max-height: var(--oc-visible-height, 100dvh) !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        overscroll-behavior: none !important;
      }

      #root {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        margin: 0 !important;
        transform:
          translateY(var(--oc-viewport-pan, 0px))
          scale(${APP_ZOOM}) !important;
        transform-origin: top left !important;
        width:
          calc(var(--oc-visible-width, 100vw) / ${APP_ZOOM})
          !important;
        min-width:
          calc(var(--oc-visible-width, 100vw) / ${APP_ZOOM})
          !important;
        max-width:
          calc(var(--oc-visible-width, 100vw) / ${APP_ZOOM})
          !important;
        height:
          calc(var(--oc-visible-height, 100dvh) / ${APP_ZOOM})
          !important;
        min-height:
          calc(var(--oc-visible-height, 100dvh) / ${APP_ZOOM})
          !important;
        max-height:
          calc(var(--oc-visible-height, 100dvh) / ${APP_ZOOM})
          !important;
      }
    `;

    document.head.appendChild(style);
    return true;
  }

  function getViewport() {
    return window.visualViewport;
  }

  function measureGeometry() {
    const vv = getViewport();

    const width = Math.max(
      1,
      Math.round(vv?.width ?? window.innerWidth)
    );

    const height = Math.max(
      1,
      Math.round(vv?.height ?? window.innerHeight)
    );

    if (height > closedViewportHeight) {
      closedViewportHeight = height;
    }

    const heightLoss = Math.max(
      0,
      closedViewportHeight - height
    );

    const keyboardOpen =
      heightLoss > KEYBOARD_THRESHOLD;

    let pan = 0;

    if (keyboardOpen) {
      const bodyTop =
        document.body?.getBoundingClientRect().top ?? 0;

      const fromOffsetTop = Math.max(
        0,
        vv?.offsetTop ?? 0
      );

      const fromPageTop = Math.max(
        0,
        vv?.pageTop ?? 0
      );

      const fromBodyRect = Math.max(
        0,
        -bodyTop
      );

      pan = Math.round(
        Math.max(
          fromOffsetTop,
          fromPageTop,
          fromBodyRect
        )
      );
    }

    return {
      width,
      height,
      pan,
      keyboardOpen
    };
  }

  function applyGeometry() {
    const {
      width,
      height,
      pan
    } = measureGeometry();

    const style = document.documentElement.style;

    if (width !== lastWidth) {
      lastWidth = width;
      style.setProperty('--oc-visible-width', `${width}px`);
    }

    if (height !== lastHeight) {
      lastHeight = height;
      style.setProperty('--oc-visible-height', `${height}px`);
    }

    if (pan !== lastPan) {
      lastPan = pan;
      style.setProperty('--oc-viewport-pan', `${pan}px`);
    }
  }

  function settleGeometry(frames = 4) {
    settleFramesRemaining = Math.max(
      settleFramesRemaining,
      frames
    );

    if (settleFrame) return;

    const tick = () => {
      settleFrame = 0;

      applyGeometry();
      settleFramesRemaining -= 1;

      if (settleFramesRemaining > 0) {
        settleFrame = requestAnimationFrame(tick);
      }
    };

    settleFrame = requestAnimationFrame(tick);
  }

  document.addEventListener(
    'pointerdown',
    event => {
      prepareEditable(event);
    },
    {
      capture: true,
      passive: true
    }
  );

  if (!window.PointerEvent) {
    document.addEventListener(
      'touchstart',
      event => {
        prepareEditable(event);
      },
      {
        capture: true,
        passive: true
      }
    );
  }

  document.addEventListener(
    'focusin',
    event => {
      const editable = findEditable(event.target);
      if (!editable) return;

      force16px(editable);
      applyGeometry();
    },
    true
  );

  window.visualViewport?.addEventListener(
    'resize',
    () => {
      applyGeometry();
      settleGeometry(4);
    },
    {
      passive: true
    }
  );

  window.visualViewport?.addEventListener(
    'scroll',
    () => {
      applyGeometry();
      settleGeometry(4);
    },
    {
      passive: true
    }
  );

  window.addEventListener(
    'resize',
    () => {
      applyGeometry();
      settleGeometry(3);
    },
    {
      passive: true
    }
  );

  window.addEventListener(
    'scroll',
    () => {
      applyGeometry();
      settleGeometry(3);
    },
    {
      passive: true
    }
  );

  function initialize() {
    installViewportMeta();
    installCSS();
    applyGeometry();
    settleGeometry(4);
  }

  function waitForDocument() {
    const viewportReady = installViewportMeta();
    const cssReady = installCSS();

    if (viewportReady && cssReady && document.body) {
      initialize();
      return;
    }

    requestAnimationFrame(waitForDocument);
  }

  waitForDocument();
})();
