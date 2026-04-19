/// <reference lib="webworker" />
/**
 * Sandbox worker for ```preact artifacts.
 *
 * 1. Boots a SafeDocument and installs it as globalThis.document.
 * 2. Receives 'mount' messages with LLM-generated Preact component source.
 * 3. Evaluates the code with a restricted scope (no fetch/XHR/WebSocket).
 * 4. Renders the component into the fake document; DOM ops are batched and
 *    forwarded to the main thread, where SafeDomApplier replays them.
 * 5. Real DOM events on the main thread are serialised back here and replayed
 *    against the shadow tree so component handlers fire as expected.
 */

import { h, render, Fragment } from "preact";
import { useState, useEffect, useRef, useMemo, useCallback } from "preact/hooks";
import { createSafeDocument, dispatchSafeEvent } from "./safe-dom-worker";
import { evaluate } from "./evaluator";
import type { DomOp, MainToWorkerMessage, WorkerToMainMessage } from "./safe-dom-types";
import { ROOT_NODE_ID } from "./safe-dom-types";

const safeDoc = createSafeDocument((ops: DomOp[]) => {
  const msg: WorkerToMainMessage = { type: "ops", ops };
  self.postMessage(msg);
});

// Preact's reconciler reads document.createElement etc. — install before any render.
const g = globalThis as unknown as Record<string, unknown>;
g.document = safeDoc;
g.window = {
  document: safeDoc,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: "" },
};

const readyMsg: WorkerToMainMessage = { type: "ready", rootId: ROOT_NODE_ID };
self.postMessage(readyMsg);

const SANDBOX_GLOBALS: Record<string, unknown> = {
  h,
  Fragment,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  document: safeDoc,
  // Shadow dangerous globals — even though the Proxy catch-all returns undefined,
  // listing them here documents the boundary explicitly.
  fetch: undefined,
  XMLHttpRequest: undefined,
  WebSocket: undefined,
  navigator: undefined,
  localStorage: undefined,
  sessionStorage: undefined,
  indexedDB: undefined,
};

self.addEventListener("message", (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;

  if (msg.type === "mount") {
    try {
      const ComponentFn = evaluate(msg.code, SANDBOX_GLOBALS);
      render(
        h(ComponentFn as Parameters<typeof h>[0], msg.props ?? {}),
        safeDoc.body as unknown as Element,
      );
    } catch (err) {
      const errMsg: WorkerToMainMessage = {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(errMsg);
    }
  }

  if (msg.type === "event") {
    dispatchSafeEvent(msg.id, msg.eventType, msg.eventData);
  }

  if (msg.type === "unmount") {
    render(null, safeDoc.body as unknown as Element);
  }
});
