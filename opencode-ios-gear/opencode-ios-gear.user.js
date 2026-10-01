// ==UserScript==
// @name         OpenCode iOS Fixes for Gear
// @namespace    local.opencode
// @version      1.0.6
// @description  Fix iOS input zoom, keyboard viewport behavior, and UI density in Gear
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

  /*
   * Stable rollback:
   * This restores the last known-good keyboard/layout strategy.
   */

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

  let keyboardActive = false;
  let lastViewportWidth = 0;
  let lastViewportHeight = 0;
  let resizeFrame = 0;
  let scrollCorrectionFrame = 0;

  function findEditable(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    if (target.matches(EDITABLE)) {
      return target;
    }

    return target.closest(EDITABLE);
  }

  function force16px(el) {
    if (!(el instanceof HTMLElement)) {
      return;
    }

    el.style.setProperty(
      'font-size',
      '16px',
      'important'
    );

    el.style.setProperty(
      '-webkit-text-size-adjust',
      '100%',
      'important'
    );
  }

  function prepareEditable(event) {
    const path =
      typeof event.composedPath === 'function'
        ? event.composedPath()
        : [event.target];

    for (const node of path) {
      const editable = findEditable(node);

      if (!editable) {
        continue;
      }

      force16px(editable);
      return editable;
    }

    return null;
  }

  function installViewportMeta() {
    if (!document.head) {
      return false;
    }

    let viewport =
      document.querySelector(
        'meta[name="viewport"]'
      );

    if (!viewport) {
      viewport =
        document.createElement('meta');

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
    if (
      !document.head ||
      document.getElementById(
        'opencode-ios-fixes'
      )
    ) {
      return false;
    }

    const style =
      document.createElement('style');

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
        -webkit-tap-highlight-color:
          transparent !important;
      }

      html,
      body,
      #root {
        -webkit-font-smoothing:
          antialiased;
        text-rendering:
          optimizeLegibility;
      }

      html {
        position: fixed !important;
        inset: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
        overscroll-behavior:
          none !important;
      }

      body {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;

        margin: 0 !important;
        padding: 0 !important;

        width:
          var(--oc-visible-width, 100vw)
          !important;

        height:
          var(--oc-visible-height, 100dvh)
          !important;

        min-width:
          var(--oc-visible-width, 100vw)
          !important;

        max-width:
          var(--oc-visible-width, 100vw)
          !important;

        min-height:
          var(--oc-visible-height, 100dvh)
          !important;

        max-height:
          var(--oc-visible-height, 100dvh)
          !important;

        overflow: hidden !important;

        overscroll-behavior:
          none !important;

        scroll-behavior:
          auto !important;
      }

      #root {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        margin: 0 !important;

        transform:
          scale(${APP_ZOOM})
          !important;

        transform-origin:
          top left
          !important;

        width:
          calc(
            var(--oc-visible-width, 100vw)
            / ${APP_ZOOM}
          )
          !important;

        min-width:
          calc(
            var(--oc-visible-width, 100vw)
            / ${APP_ZOOM}
          )
          !important;

        max-width:
          calc(
            var(--oc-visible-width, 100vw)
            / ${APP_ZOOM}
          )
          !important;

        height:
          calc(
            var(--oc-visible-height, 100dvh)
            / ${APP_ZOOM}
          )
          !important;

        min-height:
          calc(
            var(--oc-visible-height, 100dvh)
            / ${APP_ZOOM}
          )
          !important;

        max-height:
          calc(
            var(--oc-visible-height, 100dvh)
            / ${APP_ZOOM}
          )
          !important;
      }
    `;

    document.head.appendChild(style);
    return true;
  }

  function getViewportSize() {
    const vv = window.visualViewport;

    return {
      width: Math.max(
        1,
        Math.round(
          vv?.width ||
          window.innerWidth
        )
      ),

      height: Math.max(
        1,
        Math.round(
          vv?.height ||
          window.innerHeight
        )
      )
    };
  }

  function applyViewportSize() {
    const {
      width,
      height
    } = getViewportSize();

    const style =
      document.documentElement.style;

    if (
      width !==
      lastViewportWidth
    ) {
      lastViewportWidth =
        width;

      style.setProperty(
        '--oc-visible-width',
        `${width}px`
      );
    }

    if (
      height !==
      lastViewportHeight
    ) {
      lastViewportHeight =
        height;

      style.setProperty(
        '--oc-visible-height',
        `${height}px`
      );
    }
  }

  function isKeyboardProbablyOpen() {
    const vv =
      window.visualViewport;

    if (!vv) {
      return keyboardActive;
    }

    const lostHeight =
      window.outerHeight -
      vv.height;

    return lostHeight >
      KEYBOARD_THRESHOLD;
  }

  function resetDocumentScroll() {
    if (
      window.scrollX === 0 &&
      window.scrollY === 0 &&
      document.documentElement
        .scrollTop === 0
    ) {
      return;
    }

    window.scrollTo(
      0,
      0
    );

    document.documentElement
      .scrollTop = 0;

    document.documentElement
      .scrollLeft = 0;

    if (document.body) {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    }
  }

  function scheduleScrollCorrection() {
    if (
      scrollCorrectionFrame
    ) {
      return;
    }

    scrollCorrectionFrame =
      requestAnimationFrame(
        () => {
          scrollCorrectionFrame = 0;

          resetDocumentScroll();
        }
      );
  }

  function updateViewport() {
    resizeFrame = 0;

    keyboardActive =
      isKeyboardProbablyOpen();

    applyViewportSize();

    if (keyboardActive) {
      resetDocumentScroll();
    }
  }

  function scheduleViewportUpdate() {
    if (resizeFrame) {
      return;
    }

    resizeFrame =
      requestAnimationFrame(
        updateViewport
      );
  }

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

  document.addEventListener(
    'focusin',
    event => {
      const editable =
        findEditable(
          event.target
        );

      if (!editable) {
        return;
      }

      force16px(
        editable
      );

      resetDocumentScroll();

      scheduleViewportUpdate();

      setTimeout(
        scheduleViewportUpdate,
        80
      );

      setTimeout(
        scheduleViewportUpdate,
        250
      );
    },
    true
  );

  document.addEventListener(
    'focusout',
    () => {
      scheduleViewportUpdate();

      setTimeout(
        scheduleViewportUpdate,
        100
      );

      setTimeout(
        scheduleViewportUpdate,
        300
      );
    },
    true
  );

  window.addEventListener(
    'resize',
    scheduleViewportUpdate,
    {
      passive: true
    }
  );

  window.visualViewport
    ?.addEventListener(
      'resize',
      scheduleViewportUpdate,
      {
        passive: true
      }
    );

  window.addEventListener(
    'scroll',
    () => {
      if (
        keyboardActive ||
        window.scrollY !== 0
      ) {
        scheduleScrollCorrection();
      }
    },
    {
      passive: true
    }
  );

  window.visualViewport
    ?.addEventListener(
      'scroll',
      () => {
        if (keyboardActive) {
          scheduleScrollCorrection();
        }
      },
      {
        passive: true
      }
    );

  function initialize() {
    installViewportMeta();
    installCSS();

    applyViewportSize();
    resetDocumentScroll();

    requestAnimationFrame(
      applyViewportSize
    );

    setTimeout(
      scheduleViewportUpdate,
      150
    );
  }

  function waitForDocument() {
    const viewportReady =
      installViewportMeta();

    const cssReady =
      installCSS();

    if (
      viewportReady &&
      cssReady &&
      document.body
    ) {
      initialize();
      return;
    }

    requestAnimationFrame(
      waitForDocument
    );
  }

  waitForDocument();
})();
