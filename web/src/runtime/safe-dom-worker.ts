/**
 * Worker-side Safe DOM stubs.
 * Provides a fake `document` whose mutation methods emit serialised DomOps
 * (batched per microtask). Reads (firstChild, nextSibling, …) are served from
 * an in-memory shadow tree so Preact's reconciler stays consistent.
 */

import type { DomOp, NodeId, SerializedEvent } from "./safe-dom-types";
import { ROOT_NODE_ID } from "./safe-dom-types";

type EmitFn = (ops: DomOp[]) => void;
let _emit: EmitFn = () => {};
let _pending: DomOp[] = [];
let _scheduled = false;

function setEmitter(fn: EmitFn) {
  _emit = fn;
}

function emit(op: DomOp) {
  _pending.push(op);
  if (!_scheduled) {
    _scheduled = true;
    queueMicrotask(() => {
      _scheduled = false;
      if (_pending.length) {
        _emit([..._pending]);
        _pending = [];
      }
    });
  }
}

let _nextId: NodeId = ROOT_NODE_ID + 1;
const _nodeRegistry = new Map<NodeId, SafeElementBase>();

function nextId(): NodeId {
  return _nextId++;
}

interface StyleLike {
  cssText: string;
  setProperty(prop: string, value: string, priority?: string): void;
  removeProperty(prop: string): string;
  getPropertyValue(prop: string): string;
  [key: string]: unknown;
}

class SafeStyle {
  private _id: NodeId;
  private _data: Record<string, string> = {};

  constructor(id: NodeId) {
    this._id = id;
  }

  setProperty(prop: string, value: string, _priority?: string) {
    if (value == null || value === "") {
      delete this._data[prop];
      emit({ op: "removeStyleProperty", id: this._id, prop });
    } else {
      this._data[prop] = value;
      emit({ op: "setStyleProperty", id: this._id, prop, value });
    }
  }

  removeProperty(prop: string): string {
    const old = this._data[prop] ?? "";
    delete this._data[prop];
    emit({ op: "removeStyleProperty", id: this._id, prop });
    return old;
  }

  getPropertyValue(prop: string): string {
    return this._data[prop] ?? "";
  }

  get cssText(): string {
    return Object.entries(this._data)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  }
  set cssText(value: string) {
    this._data = {};
    emit({ op: "setStyleCssText", id: this._id, value });
    for (const decl of value.split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim();
      const val = decl.slice(idx + 1).trim();
      if (prop) this._data[prop] = val;
    }
  }
}

function makeStyleProxy(style: SafeStyle): StyleLike {
  return new Proxy(style, {
    set(target, prop: string | symbol, value: unknown) {
      if (typeof prop === "symbol") return true;
      if (prop === "cssText") {
        target.cssText = value as string;
        return true;
      }
      const kebab = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      if (value == null || value === "") target.removeProperty(kebab);
      else target.setProperty(kebab, String(value));
      return true;
    },
    get(target, prop: string | symbol): unknown {
      if (typeof prop === "symbol") return undefined;
      if (prop in target) return (target as unknown as AnyRecord)[prop];
      return target.getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());
    },
  }) as unknown as StyleLike;
}

type SafeNode = SafeElementBase | SafeText | SafeComment;

const DOM_PROPERTY_NAMES = new Set([
  "value",
  "checked",
  "selected",
  "multiple",
  "defaultValue",
  "defaultChecked",
  "selectedIndex",
  "tabIndex",
  "disabled",
  "readOnly",
  "required",
  "autofocus",
  "autoFocus",
  "href",
  "src",
  "alt",
  "title",
  "placeholder",
  "type",
  "width",
  "height",
  "htmlFor",
  "scope",
  "accept",
  "autoComplete",
  "contentEditable",
  "spellCheck",
  "draggable",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

class SafeElementBase {
  readonly _id: NodeId;
  readonly _tag: string;
  readonly _ns: string | null;
  readonly style: StyleLike;

  _children: SafeNode[] = [];
  _parent: SafeNode | null = null;
  _attrs: Map<string, string> = new Map();
  _handlers: Map<string, EventListenerOrEventListenerObject> = new Map();
  _listeners: Record<string, (e: unknown) => void> = {};

  constructor(id: NodeId, tag: string, ns: string | null = null) {
    this._id = id;
    this._tag = tag.toUpperCase();
    this._ns = ns;
    this.style = makeStyleProxy(new SafeStyle(id));
  }

  get nodeType() {
    return 1;
  }
  get nodeName() {
    return this._tag;
  }
  get tagName() {
    return this._tag;
  }
  get localName() {
    return this._tag.toLowerCase();
  }
  get namespaceURI() {
    return this._ns;
  }
  get parentNode() {
    return this._parent;
  }
  get parentElement(): SafeElementBase | null {
    return this._parent instanceof SafeElementBase ? this._parent : null;
  }
  get firstChild(): SafeNode | null {
    return this._children[0] ?? null;
  }
  get lastChild(): SafeNode | null {
    return this._children[this._children.length - 1] ?? null;
  }
  get nextSibling(): SafeNode | null {
    if (!this._parent) return null;
    const siblings = (this._parent as SafeElementBase)._children;
    const i = siblings.indexOf(this);
    return i === -1 ? null : (siblings[i + 1] ?? null);
  }
  get previousSibling(): SafeNode | null {
    if (!this._parent) return null;
    const siblings = (this._parent as SafeElementBase)._children;
    const i = siblings.indexOf(this);
    return i <= 0 ? null : siblings[i - 1];
  }
  get childNodes() {
    return this._children;
  }
  get ownerDocument() {
    return _docSingleton;
  }
  get ownerSVGElement() {
    return null;
  }

  setAttribute(name: string, value: string) {
    this._attrs.set(name, String(value));
    emit({ op: "setAttribute", id: this._id, name, value: String(value) });
  }
  setAttributeNS(_ns: string | null, name: string, value: string) {
    this.setAttribute(name, value);
  }
  removeAttribute(name: string) {
    this._attrs.delete(name);
    emit({ op: "removeAttribute", id: this._id, name });
  }
  removeAttributeNS(_ns: string | null, name: string) {
    this.removeAttribute(name);
  }
  getAttribute(name: string): string | null {
    return this._attrs.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this._attrs.has(name);
  }

  appendChild<T extends SafeNode>(child: T): T {
    this._unlink(child);
    (child as unknown as SafeElementBase)._parent = this;
    this._children.push(child);
    emit({ op: "insertBefore", parentId: this._id, nodeId: child2id(child), refId: null });
    return child;
  }
  insertBefore<T extends SafeNode>(newNode: T, ref: SafeNode | null): T {
    this._unlink(newNode);
    (newNode as unknown as SafeElementBase)._parent = this;
    if (ref === null) {
      this._children.push(newNode);
      emit({ op: "insertBefore", parentId: this._id, nodeId: child2id(newNode), refId: null });
    } else {
      const i = this._children.indexOf(ref);
      if (i === -1) this._children.push(newNode);
      else this._children.splice(i, 0, newNode);
      emit({
        op: "insertBefore",
        parentId: this._id,
        nodeId: child2id(newNode),
        refId: child2id(ref),
      });
    }
    return newNode;
  }
  removeChild<T extends SafeNode>(child: T): T {
    const i = this._children.indexOf(child);
    if (i !== -1) {
      this._children.splice(i, 1);
      (child as unknown as SafeElementBase)._parent = null;
    }
    emit({ op: "removeChild", parentId: this._id, nodeId: child2id(child) });
    return child;
  }
  replaceChild<T extends SafeNode>(newNode: T, old: SafeNode): T {
    this.insertBefore(newNode, old);
    this.removeChild(old);
    return newNode;
  }

  addEventListener(type: string, handler: EventListenerOrEventListenerObject, _opts?: unknown) {
    const existing = this._handlers.has(type);
    this._handlers.set(type, handler);
    if (!existing) emit({ op: "addEventListener", id: this._id, eventType: type });
  }
  removeEventListener(type: string, _handler?: unknown, _opts?: unknown) {
    if (this._handlers.has(type)) {
      this._handlers.delete(type);
      emit({ op: "removeEventListener", id: this._id, eventType: type });
    }
  }

  get innerHTML() {
    return "";
  }
  set innerHTML(_v: string) {
    /* noop — security */
  }
  get textContent(): string {
    return this._children.map((c) => (c as AnyRecord).textContent ?? "").join("");
  }
  set textContent(value: string) {
    for (const child of [...this._children]) this.removeChild(child);
    if (value) {
      const tn = new SafeText(value);
      this.appendChild(tn as unknown as SafeNode);
    }
  }
  normalize() {
    /* noop */
  }
  contains(_n: unknown) {
    return false;
  }

  _setProperty(name: string, value: unknown) {
    emit({
      op: "setProperty",
      id: this._id,
      name,
      value: value as string | number | boolean | null,
    });
  }

  _dispatchEvent(eventType: string, eventData: SerializedEvent) {
    const handler = this._handlers.get(eventType);
    if (!handler) return;
    const proxy = _proxyOf(this);
    const fakeEvent = buildFakeEvent(eventType, eventData, proxy);
    if (typeof handler === "function") {
      (handler as (e: unknown) => void).call(proxy, fakeEvent);
    } else {
      handler.handleEvent(fakeEvent as Event);
    }
  }

  private _unlink(child: SafeNode) {
    const p = (child as unknown as SafeElementBase)._parent as SafeElementBase | null;
    if (p) {
      const i = p._children.indexOf(child);
      if (i !== -1) p._children.splice(i, 1);
      (child as unknown as SafeElementBase)._parent = null;
    }
  }
}

function child2id(node: SafeNode): NodeId {
  return (node as unknown as SafeElementBase)._id;
}

class SafeText {
  readonly _id: NodeId = nextId();
  _parent: SafeNode | null = null;
  private _data: string;

  constructor(text: string) {
    this._data = text;
    emit({ op: "createTextNode", id: this._id, text });
  }

  get nodeType() {
    return 3;
  }
  get nodeName() {
    return "#text";
  }
  get parentNode() {
    return this._parent;
  }
  get parentElement(): SafeElementBase | null {
    return this._parent instanceof SafeElementBase ? this._parent : null;
  }
  get ownerDocument() {
    return _docSingleton;
  }
  get nextSibling(): SafeNode | null {
    if (!this._parent) return null;
    const siblings = (this._parent as SafeElementBase)._children;
    const i = siblings.indexOf(this as unknown as SafeNode);
    return i === -1 ? null : (siblings[i + 1] ?? null);
  }
  get previousSibling(): SafeNode | null {
    if (!this._parent) return null;
    const siblings = (this._parent as SafeElementBase)._children;
    const i = siblings.indexOf(this as unknown as SafeNode);
    return i <= 0 ? null : siblings[i - 1];
  }
  get data() {
    return this._data;
  }
  set data(v: string) {
    this._data = v;
    emit({ op: "setTextData", id: this._id, text: v });
  }
  get nodeValue() {
    return this._data;
  }
  set nodeValue(v: string) {
    this.data = v;
  }
  get textContent() {
    return this._data;
  }
  set textContent(v: string) {
    this.data = v;
  }
}

class SafeComment {
  readonly _id: NodeId = nextId();
  _parent: SafeNode | null = null;

  constructor(text: string) {
    emit({ op: "createComment", id: this._id, text });
  }

  get nodeType() {
    return 8;
  }
  get nodeName() {
    return "#comment";
  }
  get parentNode() {
    return this._parent;
  }
  get ownerDocument() {
    return _docSingleton;
  }
  get nextSibling(): SafeNode | null {
    if (!this._parent) return null;
    const siblings = (this._parent as SafeElementBase)._children;
    const i = siblings.indexOf(this as unknown as SafeNode);
    return i === -1 ? null : (siblings[i + 1] ?? null);
  }
  get previousSibling(): SafeNode | null {
    if (!this._parent) return null;
    const siblings = (this._parent as SafeElementBase)._children;
    const i = siblings.indexOf(this as unknown as SafeNode);
    return i <= 0 ? null : siblings[i - 1];
  }
}

const _proxyCache = new WeakMap<SafeElementBase, SafeElementBase>();

function _proxyOf(base: SafeElementBase): SafeElementBase {
  const hit = _proxyCache.get(base);
  if (hit) return hit;
  const proxy = new Proxy(base, {
    set(target, prop: string | symbol, value: unknown): boolean {
      if (typeof prop === "symbol") {
        (target as unknown as Record<symbol, unknown>)[prop] = value;
        return true;
      }
      if (prop.startsWith("_") || prop === "style") {
        (target as AnyRecord)[prop] = value;
        return true;
      }
      if (prop === "className") {
        target.setAttribute("class", String(value ?? ""));
        return true;
      }
      if (prop === "htmlFor") {
        target.setAttribute("for", String(value ?? ""));
        return true;
      }
      if (prop === "textContent") {
        target.textContent = value as string;
        return true;
      }
      if (prop === "innerHTML") {
        return true;
      }
      if (
        prop.length > 2 &&
        prop[0] === "o" &&
        prop[1] === "n" &&
        prop[2] === prop[2].toUpperCase()
      ) {
        const type = prop.slice(2).toLowerCase();
        if (typeof value === "function") target.addEventListener(type, value as EventListener);
        else target.removeEventListener(type);
        return true;
      }
      if (DOM_PROPERTY_NAMES.has(prop)) {
        (target as AnyRecord)[prop] = value;
        target._setProperty(prop, value);
        return true;
      }
      if (prop in target) {
        (target as AnyRecord)[prop] = value;
        return true;
      }
      if (value == null || value === false) {
        target.removeAttribute(prop);
        return true;
      }
      // Non-primitive values aren't HTML attributes — they're framework-internal
      // state (e.g. Preact's minified `n.l = {}` listener map). Store as a
      // real property so subsequent reads return the same object.
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        (target as AnyRecord)[prop] = value;
        return true;
      }
      target.setAttribute(prop, String(value));
      return true;
    },
    get(target, prop: string | symbol): unknown {
      if (typeof prop === "symbol") return (target as unknown as Record<symbol, unknown>)[prop];
      if (prop in target) return (target as AnyRecord)[prop];
      return undefined;
    },
    has(target, prop: string | symbol): boolean {
      if (typeof prop === "symbol") return (prop as symbol) in target;
      if (DOM_PROPERTY_NAMES.has(prop)) return true;
      // Fake lowercase `on*` props so Preact's `lowerCaseName in dom` check
      // succeeds and it registers listeners with the correct (lowercase) type.
      if (/^on[a-z]+$/.test(prop)) return true;
      return prop in target;
    },
  });
  _proxyCache.set(base, proxy);
  return proxy;
}

function createSafeElement(tag: string, ns?: string): SafeElementBase {
  const id = nextId();
  const base = new SafeElementBase(id, tag, ns ?? null);
  _nodeRegistry.set(id, base);
  if (ns) emit({ op: "createElementNS", id, ns, tag });
  else emit({ op: "createElement", id, tag });
  return _proxyOf(base);
}

class SafeDocument {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  readonly body: SafeElementBase;
  readonly documentElement: SafeElementBase;
  readonly head: SafeElementBase;

  constructor() {
    const root = new SafeElementBase(ROOT_NODE_ID, "div");
    _nodeRegistry.set(ROOT_NODE_ID, root);
    this.body = _proxyOf(root);
    this.documentElement = this.body;
    this.head = this.body;
  }

  createElement(tag: string): SafeElementBase {
    return createSafeElement(tag);
  }
  createElementNS(ns: string | null, tag: string): SafeElementBase {
    return createSafeElement(tag, ns ?? undefined);
  }
  createTextNode(text: string): SafeText {
    return new SafeText(text);
  }
  createComment(text: string): SafeComment {
    return new SafeComment(text);
  }
  createDocumentFragment(): SafeElementBase {
    return createSafeElement("div");
  }

  getElementById(_id: string): null {
    return null;
  }
  querySelector(_sel: string): null {
    return null;
  }
  querySelectorAll(_sel: string): [] {
    return [];
  }
}

let _docSingleton: SafeDocument | null = null;

export function createSafeDocument(emitFn: EmitFn): SafeDocument {
  setEmitter(emitFn);
  _docSingleton = new SafeDocument();
  return _docSingleton;
}

export function dispatchSafeEvent(id: NodeId, eventType: string, eventData: SerializedEvent): void {
  _nodeRegistry.get(id)?._dispatchEvent(eventType, eventData);
}

function buildFakeEvent(type: string, data: SerializedEvent, target: SafeElementBase): unknown {
  return {
    type,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    target,
    currentTarget: target,
    preventDefault: () => {},
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
    key: data.key ?? "",
    code: data.code ?? "",
    value: data.value ?? "",
    clientX: data.clientX ?? 0,
    clientY: data.clientY ?? 0,
    button: data.button ?? 0,
    altKey: data.altKey ?? false,
    ctrlKey: data.ctrlKey ?? false,
    shiftKey: data.shiftKey ?? false,
    metaKey: data.metaKey ?? false,
    ...(data.value !== undefined || data.checked !== undefined
      ? { target: { ...target, value: data.value ?? "", checked: data.checked ?? false } }
      : {}),
  };
}
