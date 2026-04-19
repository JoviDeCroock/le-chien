/**
 * Main-thread side of Safe DOM.
 * Receives DomOp arrays from the worker and applies them to real DOM nodes
 * using a nodeMap that correlates NodeIds with live HTMLElements. Also forwards
 * real DOM events back through the worker's serialised event channel.
 */

import type { DomOp, NodeId, SerializedEvent } from "./safe-dom-types";
import { ROOT_NODE_ID } from "./safe-dom-types";

type PostEventFn = (id: NodeId, eventType: string, eventData: SerializedEvent) => void;

export class SafeDomApplier {
  private nodeMap = new Map<NodeId, Node>();
  private eventListeners = new Map<NodeId, Map<string, (e: Event) => void>>();
  private postEvent: PostEventFn;

  constructor(rootElement: Element, postEvent: PostEventFn) {
    this.postEvent = postEvent;
    this.nodeMap.set(ROOT_NODE_ID, rootElement);
  }

  apply(ops: DomOp[]): void {
    for (const op of ops) this.applyOne(op);
  }

  private applyOne(op: DomOp): void {
    switch (op.op) {
      case "createElement": {
        const el = document.createElement(op.tag);
        this.nodeMap.set(op.id, el);
        break;
      }
      case "createElementNS": {
        const el = document.createElementNS(op.ns, op.tag);
        this.nodeMap.set(op.id, el);
        break;
      }
      case "createTextNode": {
        const tn = document.createTextNode(op.text);
        this.nodeMap.set(op.id, tn);
        break;
      }
      case "createComment": {
        const cn = document.createComment(op.text);
        this.nodeMap.set(op.id, cn);
        break;
      }
      case "insertBefore": {
        const parent = this.nodeMap.get(op.parentId);
        const node = this.nodeMap.get(op.nodeId);
        const ref = op.refId !== null ? (this.nodeMap.get(op.refId) ?? null) : null;
        if (parent && node) parent.insertBefore(node, ref);
        break;
      }
      case "removeChild": {
        const parent = this.nodeMap.get(op.parentId);
        const node = this.nodeMap.get(op.nodeId);
        if (parent && node && node.parentNode === parent) {
          parent.removeChild(node);
        }
        break;
      }
      case "setAttribute": {
        const el = this.nodeMap.get(op.id) as Element | undefined;
        el?.setAttribute(op.name, op.value);
        break;
      }
      case "removeAttribute": {
        const el = this.nodeMap.get(op.id) as Element | undefined;
        el?.removeAttribute(op.name);
        break;
      }
      case "setProperty": {
        const el = this.nodeMap.get(op.id);
        if (el) (el as unknown as Record<string, unknown>)[op.name] = op.value;
        break;
      }
      case "setTextData": {
        const node = this.nodeMap.get(op.id) as Text | undefined;
        if (node) node.data = op.text;
        break;
      }
      case "setStyleProperty": {
        const el = this.nodeMap.get(op.id) as HTMLElement | undefined;
        el?.style.setProperty(op.prop, op.value);
        break;
      }
      case "removeStyleProperty": {
        const el = this.nodeMap.get(op.id) as HTMLElement | undefined;
        el?.style.removeProperty(op.prop);
        break;
      }
      case "setStyleCssText": {
        const el = this.nodeMap.get(op.id) as HTMLElement | undefined;
        if (el) el.style.cssText = op.value;
        break;
      }
      case "addEventListener": {
        const el = this.nodeMap.get(op.id);
        if (!el) break;
        if (!this.eventListeners.has(op.id)) this.eventListeners.set(op.id, new Map());
        const map = this.eventListeners.get(op.id)!;
        if (map.has(op.eventType)) break;
        const handler = (e: Event) => {
          this.postEvent(op.id, op.eventType, serializeEvent(e));
        };
        map.set(op.eventType, handler);
        el.addEventListener(op.eventType, handler);
        break;
      }
      case "removeEventListener": {
        const map = this.eventListeners.get(op.id);
        if (!map) break;
        const handler = map.get(op.eventType);
        if (!handler) break;
        const el = this.nodeMap.get(op.id);
        el?.removeEventListener(op.eventType, handler);
        map.delete(op.eventType);
        break;
      }
    }
  }

  destroy(): void {
    for (const [id, typeMap] of this.eventListeners) {
      const el = this.nodeMap.get(id);
      for (const [type, handler] of typeMap) {
        el?.removeEventListener(type, handler);
      }
    }
    this.eventListeners.clear();
    const root = this.nodeMap.get(ROOT_NODE_ID);
    if (root) {
      while (root.firstChild) root.removeChild(root.firstChild);
    }
    this.nodeMap.clear();
  }
}

function serializeEvent(e: Event): SerializedEvent {
  const se: SerializedEvent = { type: e.type };
  const target = e.target as HTMLInputElement | null;
  if (target) {
    if ("value" in target) se.value = target.value;
    if ("checked" in target) se.checked = target.checked;
  }
  if (e instanceof KeyboardEvent) {
    se.key = e.key;
    se.code = e.code;
    se.altKey = e.altKey;
    se.ctrlKey = e.ctrlKey;
    se.shiftKey = e.shiftKey;
    se.metaKey = e.metaKey;
  }
  if (e instanceof MouseEvent) {
    se.clientX = e.clientX;
    se.clientY = e.clientY;
    se.button = e.button;
    se.altKey = e.altKey;
    se.ctrlKey = e.ctrlKey;
    se.shiftKey = e.shiftKey;
    se.metaKey = e.metaKey;
  }
  return se;
}
