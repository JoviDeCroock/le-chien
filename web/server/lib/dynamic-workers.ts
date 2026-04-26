import preactHooksModuleSource from "preact/hooks?raw";
import preactModuleSource from "preact?raw";

export type ArtifactTextNode = string | number;

export type ArtifactElementNode = {
  tag: string;
  props?: Record<string, unknown>;
  events?: Partial<Record<"click" | "input" | "change" | "submit", string>>;
  children?: ArtifactNode[];
};

export type ArtifactNode = ArtifactTextNode | ArtifactElementNode | ArtifactNode[];

export type ArtifactRenderInput = {
  artifactId: string;
  code: string;
  event?: {
    id: string;
    type: "click" | "input" | "change" | "submit";
    value?: string;
    checked?: boolean;
  };
};

export type ArtifactRenderResult = {
  tree?: ArtifactNode;
  error?: string;
};

export type PreparedArtifactWorker = {
  cacheId: string;
  componentName: string;
  source: string;
};

export type JavaScriptRunResult = {
  result?: string;
  logs?: string[];
  error?: string;
};

const DYNAMIC_WORKER_COMPATIBILITY_DATE = "2026-04-25";
const DYNAMIC_WORKER_MODULE = "index.js";
const DYNAMIC_PREACT_MODULE = "preact.js";
const DYNAMIC_PREACT_HOOKS_MODULE = "preact-hooks.js";
export const ARTIFACT_FACET_EXPORT_NAME = "LeChienArtifactRuntimeFacet";
const MAX_DYNAMIC_WORKER_ERROR_LENGTH = 500;
const MAX_ARTIFACT_CODE_CHARS = 24_000;
const MAX_JAVASCRIPT_CODE_CHARS = 16_000;
const preactHooksWorkerSource = preactHooksModuleSource.replace(
  /from(["'])preact\1/g,
  `from$1./${DYNAMIC_PREACT_MODULE}$1`,
);
const artifactWorkerRuntimeModules = {
  [DYNAMIC_PREACT_MODULE]: preactModuleSource,
  [DYNAMIC_PREACT_HOOKS_MODULE]: preactHooksWorkerSource,
};

type DynamicWorkerResponse<T> = T & {
  error?: string;
};

interface StripResult {
  code: string;
  exportName: string | null;
}

function stripModuleSyntax(raw: string): StripResult {
  let code = raw;
  let exportName: string | null = null;

  code = code.replace(/^import\b[^;]+;?\s*$/gm, "");

  code = code.replace(/export\s+default\s+function\s+(\w+)/, (_m, name) => {
    exportName = name;
    return `function ${name}`;
  });

  code = code.replace(/^export\s+default\s+(\w+)\s*;?\s*$/m, (_m, name) => {
    exportName ??= name;
    return "";
  });

  code = code.replace(/^export\s+(default\s+)?/gm, "");

  return { code: code.trim(), exportName };
}

function findComponentName(code: string): string | null {
  const fnMatches = [...code.matchAll(/function\s+([A-Z]\w*)\s*\(/g)];
  if (fnMatches.length) return fnMatches[fnMatches.length - 1][1];

  const constMatches = [...code.matchAll(/(?:const|let|var)\s+([A-Z]\w*)\s*=/g)];
  if (constMatches.length) return constMatches[constMatches.length - 1][1];

  return null;
}

function formatDynamicWorkerError(err: unknown) {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return message.slice(0, MAX_DYNAMIC_WORKER_ERROR_LENGTH);
}

async function callDynamicWorker<T>(
  env: Cloudflare.Env,
  source: string,
  input: unknown,
  cacheId?: string,
  extraModules: Record<string, string> = {},
): Promise<DynamicWorkerResponse<T>> {
  const worker = loadDynamicWorker(env, source, cacheId, extraModules);

  const response = await worker.getEntrypoint().fetch("https://sandbox.local/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseDynamicWorkerResponse(response);
}

function loadDynamicWorker(
  env: Cloudflare.Env,
  source: string,
  cacheId?: string,
  extraModules: Record<string, string> = {},
): WorkerStub {
  if (!env.LOADER) {
    throw new Error("Dynamic Worker Loader binding is not configured");
  }

  const code = {
    compatibilityDate: DYNAMIC_WORKER_COMPATIBILITY_DATE,
    mainModule: DYNAMIC_WORKER_MODULE,
    modules: {
      [DYNAMIC_WORKER_MODULE]: source,
      ...extraModules,
    },
    globalOutbound: null,
  };
  return cacheId ? env.LOADER.get(cacheId, () => code) : env.LOADER.load(code);
}

async function parseDynamicWorkerResponse<T>(
  response: Response,
): Promise<DynamicWorkerResponse<T>> {
  const text = await response.text();
  let data: DynamicWorkerResponse<T>;
  try {
    data = text ? (JSON.parse(text) as DynamicWorkerResponse<T>) : ({} as DynamicWorkerResponse<T>);
  } catch {
    throw new Error(`Dynamic Worker returned invalid JSON: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.error ?? `Dynamic Worker failed with HTTP ${response.status}`);
  }

  return data;
}

async function getWorkerCacheId(prefix: string, source: string) {
  const encoded = new TextEncoder().encode(`${DYNAMIC_WORKER_COMPATIBILITY_DATE}\n${source}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}-${hash}`;
}

export async function runDynamicJavaScript(
  env: Cloudflare.Env,
  code: string,
): Promise<JavaScriptRunResult> {
  if (code.length > MAX_JAVASCRIPT_CODE_CHARS) {
    return { error: `Code is too large. Limit is ${MAX_JAVASCRIPT_CODE_CHARS} characters.` };
  }

  try {
    return await callDynamicWorker<JavaScriptRunResult>(env, buildJavaScriptWorkerSource(code), {});
  } catch (err) {
    return { error: formatDynamicWorkerError(err) };
  }
}

export async function prepareDynamicArtifactWorker(
  code: string,
): Promise<PreparedArtifactWorker | { error: string }> {
  if (code.length > MAX_ARTIFACT_CODE_CHARS) {
    return { error: `Artifact code is too large. Limit is ${MAX_ARTIFACT_CODE_CHARS} characters.` };
  }

  const stripped = stripModuleSyntax(code);
  const componentName = stripped.exportName ?? findComponentName(stripped.code);
  if (!componentName) {
    return {
      error:
        "Cannot determine component name. Artifact code must end with a PascalCase function or const component.",
    };
  }

  try {
    const source = buildArtifactWorkerSource(stripped.code, componentName);
    const cacheId = await getWorkerCacheId(
      "artifact",
      [source, preactModuleSource, preactHooksWorkerSource].join("\n"),
    );
    return { cacheId, componentName, source };
  } catch (err) {
    return { error: formatDynamicWorkerError(err) };
  }
}

export function loadDynamicArtifactWorker(
  env: Cloudflare.Env,
  prepared: PreparedArtifactWorker,
): WorkerStub {
  return loadDynamicWorker(env, prepared.source, prepared.cacheId, artifactWorkerRuntimeModules);
}

function buildJavaScriptWorkerSource(code: string) {
  return `
const MAX_LOGS = 50;
const MAX_STRING_LENGTH = 12_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serialize(value, seen = new WeakSet()) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  const valueType = typeof value;
  if (valueType === "string") return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) + "\\n...[truncated]" : value;
  if (valueType === "number" || valueType === "boolean" || valueType === "bigint") return String(value);
  if (valueType === "symbol" || valueType === "function") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  try {
    const jsonValue = JSON.stringify(value, (_key, nested) => {
      if (typeof nested === "bigint") return nested.toString();
      if (typeof nested === "function") return "[Function]";
      if (typeof nested === "symbol") return String(nested);
      return nested;
    }, 2);
    if (jsonValue === undefined) return String(value);
    return jsonValue.length > MAX_STRING_LENGTH ? jsonValue.slice(0, MAX_STRING_LENGTH) + "\\n...[truncated]" : jsonValue;
  } catch {
    return String(value);
  }
}

export default {
  async fetch() {
    const logs = [];
    const pushLog = (...args) => {
      if (logs.length >= MAX_LOGS) return;
      logs.push(args.map((arg) => serialize(arg)).join(" "));
    };
    const console = {
      log: pushLog,
      info: pushLog,
      warn: pushLog,
      error: pushLog,
    };
    const fetch = undefined;
    const WebSocket = undefined;
    const XMLHttpRequest = undefined;
    const EventSource = undefined;
    const localStorage = undefined;
    const sessionStorage = undefined;
    const caches = undefined;
    const navigator = undefined;

    try {
      const result = await (async () => {
${code}
      })();
      return json({ result: serialize(result), logs });
    } catch (err) {
      return json({ error: err instanceof Error ? err.name + ": " + err.message : String(err), logs }, 400);
    }
  },
};
`;
}

function buildArtifactWorkerSource(code: string, componentName: string) {
  return `
import { DurableObject } from "cloudflare:workers";
import { Fragment as __PreactFragment, h as __preactH, options as __preactOptions } from "./${DYNAMIC_PREACT_MODULE}";
import {
  useCallback as __preactUseCallback,
  useEffect as __preactUseEffect,
  useMemo as __preactUseMemo,
  useRef as __preactUseRef,
  useState as __preactUseState,
} from "./${DYNAMIC_PREACT_HOOKS_MODULE}";

const MAX_DEPTH = 30;
const MAX_NODES = 800;
const MAX_STATE_ITEMS = 50;
const MAX_STATE_JSON = 16_000;
const MAX_TEXT_LENGTH = 4_000;
const MAX_PROP_LENGTH = 1_000;
const MAX_EFFECT_PASSES = 5;
const HOOK_SLOT_KEY = "__leChienHookSlot";
const HOOK_STATE = 1;
const HOOK_REDUCER = 2;
const HOOK_EFFECT = 3;
const HOOK_LAYOUT_EFFECT = 4;
const HOOK_REF = 5;
const HOOK_ID = 11;
const EVENT_PROP_TO_TYPE = {
  onClick: "click",
  onInput: "input",
  onChange: "change",
  onSubmit: "submit",
};
const ALLOWED_TAGS = new Set([
  "a", "article", "aside", "b", "blockquote", "button", "caption", "code", "dd", "div",
  "dl", "dt", "em", "fieldset", "figcaption", "figure", "form", "h1", "h2", "h3", "h4",
  "h5", "h6", "hr", "i", "img", "input", "label", "legend", "li", "main", "ol", "option",
  "p", "pre", "progress", "section", "select", "small", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "tr", "ul",
  "svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "text",
]);
const ALLOWED_PROPS = new Set([
  "aria-label", "aria-hidden", "aria-live", "alt", "checked", "class", "className", "colSpan",
  "disabled", "height", "href", "id", "max", "maxLength", "min", "name", "placeholder",
  "readOnly", "role", "rowSpan", "selected", "src", "step", "target", "title", "type",
  "value", "viewBox", "width", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx",
  "ry", "d", "fill", "fillRule", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin",
  "strokeDasharray", "opacity", "points", "transform",
]);
const ALLOWED_STYLE_PROPS = new Set([
  "alignItems", "aspectRatio", "background", "backgroundColor", "border", "borderBottom",
  "borderColor", "borderLeft", "borderRadius", "borderRight", "borderTop", "boxShadow",
  "boxSizing", "color", "display", "flex", "flexBasis", "flexDirection", "flexGrow",
  "flexShrink", "flexWrap", "fontFamily", "fontSize", "fontStyle", "fontWeight", "gap",
  "gridTemplateColumns", "height", "justifyContent", "lineHeight", "margin", "marginBottom",
  "marginLeft", "marginRight", "marginTop", "maxHeight", "maxWidth", "minHeight", "minWidth",
  "objectFit", "opacity", "overflow", "padding", "paddingBottom", "paddingLeft",
  "paddingRight", "paddingTop", "position", "textAlign", "textDecoration", "textTransform",
  "whiteSpace", "width",
]);

const __previousHookInspector = __preactOptions.__h;
__preactOptions.__h = (component, index, hookType) => {
  if (component && component.__leChienHookTypes) {
    component.__leChienHookTypes[index] = hookType;
  }
  if (__previousHookInspector) __previousHookInspector(component, index, hookType);
};
const __previousVNodeHook = __preactOptions.vnode;
__preactOptions.vnode = (vnode) => {
  if (__previousVNodeHook) __previousVNodeHook(vnode);
  sanitizePreactVNode(vnode);
};

const __userModule = (() => {
const h = __preactH;
const Fragment = __PreactFragment;
const useState = __preactUseState;
const useEffect = __preactUseEffect;
const useRef = __preactUseRef;
const useMemo = __preactUseMemo;
const useCallback = __preactUseCallback;
const fetch = undefined;
const WebSocket = undefined;
const XMLHttpRequest = undefined;
const EventSource = undefined;
const localStorage = undefined;
const sessionStorage = undefined;
const navigator = undefined;
const document = undefined;
const window = undefined;
const setTimeout = undefined;
const setInterval = undefined;
const clearTimeout = undefined;
const clearInterval = undefined;
const requestAnimationFrame = undefined;
${code}
return { ${componentName} };
})();

const __Component = __userModule.${componentName};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeStateValue(value, depth = 0) {
  if (depth > 8) return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeStateValue(item, depth + 1));
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, nested] of Object.entries(value).slice(0, 50)) {
      if (key.length > 80) continue;
      out[key] = sanitizeStateValue(nested, depth + 1);
    }
    return out;
  }
  return null;
}

function createHookSlot(kind, data) {
  return { [HOOK_SLOT_KEY]: kind, ...data };
}

function isHookSlot(value, kind) {
  return isPlainObject(value) && value[HOOK_SLOT_KEY] === kind;
}

function sanitizeState(state) {
  const sanitized = Array.isArray(state)
    ? state.slice(0, MAX_STATE_ITEMS).map((value) => sanitizeStateValue(value))
    : [];
  const encoded = JSON.stringify(sanitized);
  if (encoded.length <= MAX_STATE_JSON) return sanitized;
  return [];
}

function sanitizeText(value) {
  const text = String(value);
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) + "..." : text;
}

function isSafeUrl(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("#") || value.startsWith("/")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

function sanitizeStyleValue(key, value) {
  if (!ALLOWED_STYLE_PROPS.has(key)) return undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).slice(0, MAX_PROP_LENGTH);
  const lowered = text.toLowerCase();
  if (lowered.includes("url(") || lowered.includes("expression") || lowered.includes("javascript:")) {
    return undefined;
  }
  if (key === "position" && lowered !== "relative" && lowered !== "static") {
    return undefined;
  }
  return value;
}

function sanitizeStyle(style) {
  if (!isPlainObject(style)) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(style)) {
    const safeValue = sanitizeStyleValue(key, value);
    if (safeValue !== undefined) out[key] = safeValue;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeEffectDeps(deps) {
  if (!Array.isArray(deps)) return null;
  return deps.slice(0, 20).map((value) => sanitizeStateValue(value));
}

function sanitizeProps(props, path, handlers) {
  const out = {};
  const events = {};
  if (!isPlainObject(props)) return { props: out, events };

  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "key" || key === "ref") continue;

    const eventType = EVENT_PROP_TO_TYPE[key];
    if (eventType && typeof value === "function") {
      const id = path + ":" + eventType;
      handlers.set(id, value);
      events[eventType] = id;
      continue;
    }

    if (key === "style") {
      const style = sanitizeStyle(value);
      if (style) out.style = style;
      continue;
    }

    if (!ALLOWED_PROPS.has(key) && !key.startsWith("aria-")) continue;
    if ((key === "href" || key === "src") && !isSafeUrl(value)) continue;
    if (key === "target" && value !== "_blank" && value !== "_self") continue;

    if (typeof value === "string") out[key] = value.slice(0, MAX_PROP_LENGTH);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
  }

  if (out.target === "_blank") out.rel = "noreferrer noopener";
  return { props: out, events };
}

function sanitizePreactVNode(vnode) {
  if (!vnode || typeof vnode.type !== "string" || !isPlainObject(vnode.props)) return;
  vnode.props = sanitizeVNodeProps(vnode.props);
}

function sanitizeVNodeProps(props) {
  const out = {};

  for (const [key, value] of Object.entries(props)) {
    if (key === "children") {
      out.children = value;
      continue;
    }
    if (key === "key" || key === "ref") continue;

    const eventType = EVENT_PROP_TO_TYPE[key];
    if (eventType && typeof value === "function") {
      out[key] = value;
      continue;
    }

    if (key === "style") {
      const style = sanitizeStyle(value);
      if (style) out.style = style;
      continue;
    }

    if (!ALLOWED_PROPS.has(key) && !key.startsWith("aria-")) continue;
    if ((key === "href" || key === "src") && !isSafeUrl(value)) continue;
    if (key === "target" && value !== "_blank" && value !== "_self") continue;

    if (typeof value === "string") out[key] = value.slice(0, MAX_PROP_LENGTH);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
  }

  return out;
}

function createRuntime(initialState) {
  let nodeCount = 0;
  let stateChanged = false;
  let componentReadIndex = 0;
  let activeComponents = [];
  let previousComponents = [];
  const initialComponentStates = normalizeInitialComponentStates(initialState);
  const handlers = new Map();

  function normalizeInitialComponentStates(state) {
    const sanitized = sanitizeState(state);
    if (sanitized.some((slot) => isHookSlot(slot, "component"))) {
      return sanitized.filter((slot) => isHookSlot(slot, "component"));
    }
    return sanitized.length > 0 ? [createHookSlot("component", { hooks: sanitized })] : [];
  }

  function getSavedHooks(componentSlot) {
    return isHookSlot(componentSlot, "component") && Array.isArray(componentSlot.hooks)
      ? componentSlot.hooks
      : [];
  }

  function createDispatch(hook, component) {
    return (action) => {
      const currentValue = hook.__N ? hook.__N[0] : hook.__?.[0];
      const reducer = typeof hook.t === "function" ? hook.t : (_current, next) => next;
      const nextValue = reducer(currentValue, action);
      if (currentValue !== nextValue) {
        hook.__N = [sanitizeStateValue(nextValue), hook.__[1]];
        component.setState({});
      }
    };
  }

  function restoreHook(slot, component) {
    if (!isPlainObject(slot)) return {};
    const kind = slot[HOOK_SLOT_KEY];
    const type = typeof slot.type === "number" ? slot.type : undefined;

    if (kind === "state" || type === HOOK_STATE || type === HOOK_REDUCER) {
      const hook = { __c: component };
      hook.__ = [sanitizeStateValue(slot.value), null];
      hook.__[1] = createDispatch(hook, component);
      return hook;
    }

    if (kind === "effect" || type === HOOK_EFFECT || type === HOOK_LAYOUT_EFFECT) {
      return { __H: sanitizeEffectDeps(slot.deps) };
    }

    if (kind === "ref" || type === HOOK_REF) {
      const value = isPlainObject(slot.value) && "current" in slot.value ? slot.value : { current: slot.value ?? null };
      return { __: sanitizeStateValue(value), __H: [] };
    }

    if (kind === "id" || type === HOOK_ID) {
      return { __: typeof slot.value === "string" ? slot.value : undefined };
    }

    return {};
  }

  function createComponent(vnode, context, savedState) {
    const component = {
      __v: vnode,
      context,
      props: vnode.props,
      setState() {
        this.__d = true;
        stateChanged = true;
      },
      forceUpdate() {
        this.__d = true;
        stateChanged = true;
      },
      __d: true,
      __h: [],
      __H: { __: [], __h: [] },
      __leChienComponentType: getComponentTypeName(vnode.type),
      __leChienHookTypes: [],
    };
    component.__H.__ = getSavedHooks(savedState).map((slot) => restoreHook(slot, component));
    return component;
  }

  function getComponentTypeName(type) {
    return typeof type === "function" ? type.displayName || type.name || "Anonymous" : String(type);
  }

  function takeComponent(vnode, context) {
    const index = componentReadIndex++;
    const typeName = getComponentTypeName(vnode.type);
    let component = previousComponents[index];
    if (!component || component.__leChienComponentType !== typeName) {
      component = createComponent(vnode, context, initialComponentStates[index]);
    }

    component.__v = vnode;
    component.context = context;
    component.props = vnode.props;
    component.__h = [];
    component.__leChienHookTypes = component.__leChienHookTypes || [];
    component.__leChienComponentType = typeName;
    vnode.__c = component;
    activeComponents[index] = component;
    return component;
  }

  function applyPendingHookUpdates(component) {
    const hooks = component.__H?.__;
    if (!Array.isArray(hooks)) return;
    for (const hook of hooks) {
      if (hook && hook.__N) {
        hook.__ = hook.__N;
        hook.__N = undefined;
      }
    }
  }

  function commitEffectDeps(component) {
    const hooks = component.__H?.__;
    if (!Array.isArray(hooks)) return;
    for (const hook of hooks) {
      if (hook && hook.u) {
        hook.__H = sanitizeEffectDeps(hook.u);
        hook.u = undefined;
      }
    }
  }

  function collectPendingEffects() {
    const effects = [];
    for (const component of previousComponents) {
      if (!component) continue;
      if (Array.isArray(component.__h) && component.__h.length > 0) {
        effects.push(...component.__h);
        component.__h = [];
      }
      if (component.__H && Array.isArray(component.__H.__h) && component.__H.__h.length > 0) {
        effects.push(...component.__H.__h);
        component.__H.__h = [];
      }
      commitEffectDeps(component);
    }
    return effects;
  }

  function runEffectCleanup(effect) {
    const cleanup = effect.__c;
    if (typeof cleanup === "function") {
      effect.__c = undefined;
      cleanup();
    }
  }

  function runEffect(effect) {
    if (typeof effect.__ !== "function") return;
    const result = effect.__();
    if (result && typeof result.then === "function") {
      result.catch(() => {});
      effect.__c = undefined;
    } else {
      effect.__c = typeof result === "function" ? result : undefined;
    }
  }

  function toChildArray(children) {
    if (children === null || children === undefined || children === false || children === true) return [];
    return Array.isArray(children) ? children : [children];
  }

  function sanitizeNode(node, path = "0", depth = 0) {
    if (depth > MAX_DEPTH || nodeCount++ > MAX_NODES) return null;
    if (node === null || node === undefined || node === false || node === true) return null;
    if (typeof node === "string" || typeof node === "number") return sanitizeText(node);
    if (Array.isArray(node)) {
      return node
        .map((child, index) => sanitizeNode(child, path + "." + index, depth + 1))
        .filter((child) => child !== null);
    }
    if (!node || typeof node !== "object") return sanitizeText(node);
    if (node.constructor !== undefined) return null;

    let tag = node.type;
    const props = isPlainObject(node.props) ? node.props : {};
    const children = toChildArray(props.children);

    if (tag === __PreactFragment) {
      return children
        .map((child, index) => sanitizeNode(child, path + "." + index, depth + 1))
        .filter((child) => child !== null);
    }

    if (typeof tag === "function") {
      const component = takeComponent(node, {});
      let rendered;
      let count = 0;
      do {
        component.__d = false;
        applyPendingHookUpdates(component);
        if (__preactOptions.__b) __preactOptions.__b(node);
        if (__preactOptions.__r) __preactOptions.__r(node);
        rendered = tag.call(component, props, {});
      } while (component.__d && ++count < 25);
      return sanitizeNode(rendered, path, depth + 1);
    }

    if (typeof tag !== "string") return null;
    tag = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return null;

    const safe = sanitizeProps(props, path, handlers);
    const safeChildren = children
      .map((child, index) => sanitizeNode(child, path + "." + index, depth + 1))
      .filter((child) => child !== null);
    const out = { tag };
    if (Object.keys(safe.props).length > 0) out.props = safe.props;
    if (Object.keys(safe.events).length > 0) out.events = safe.events;
    if (safeChildren.length > 0) out.children = safeChildren;
    return out;
  }

  function renderOnce() {
    nodeCount = 0;
    stateChanged = false;
    componentReadIndex = 0;
    activeComponents = [];
    handlers.clear();
    const tree = sanitizeNode(__preactH(__Component, {}));
    previousComponents = activeComponents;
    return tree ?? "";
  }

  async function renderWithEffects() {
    let tree = renderOnce();
    for (let pass = 0; pass < MAX_EFFECT_PASSES; pass++) {
      const effects = collectPendingEffects();
      if (effects.length === 0) return tree;
      stateChanged = false;
      for (const effect of effects) {
        runEffectCleanup(effect);
        runEffect(effect);
      }
      if (!stateChanged) return tree;
      tree = renderOnce();
    }
    return tree;
  }

  async function dispatch(event) {
    if (!event || typeof event.id !== "string") return;
    renderOnce();
    const handler = handlers.get(event.id);
    if (typeof handler !== "function") return;
    const eventObject = {
      type: event.type,
      preventDefault() {},
      stopPropagation() {},
      target: { value: event.value ?? "", checked: Boolean(event.checked) },
      currentTarget: { value: event.value ?? "", checked: Boolean(event.checked) },
    };
    await handler(eventObject);
  }

  return {
    render: renderWithEffects,
    dispatch,
    getState() {
      return sanitizeState(
        previousComponents.map((component) =>
          createHookSlot("component", {
            type: component.__leChienComponentType,
            hooks: extractHooks(component),
          }),
        ),
      );
    },
  };

  function extractHooks(component) {
    const hooks = component.__H?.__;
    if (!Array.isArray(hooks)) return [];
    return hooks.map((hook, index) => {
      const type = component.__leChienHookTypes?.[index];
      if (type === HOOK_STATE || type === HOOK_REDUCER) {
        const value = hook.__N ? hook.__N[0] : Array.isArray(hook.__) ? hook.__[0] : null;
        return createHookSlot("state", { type, value: sanitizeStateValue(value) });
      }
      if (type === HOOK_EFFECT || type === HOOK_LAYOUT_EFFECT) {
        return createHookSlot("effect", { type, deps: sanitizeEffectDeps(hook.__H) });
      }
      if (type === HOOK_REF) {
        return createHookSlot("ref", { type, value: sanitizeStateValue(hook.__) });
      }
      if (type === HOOK_ID) {
        return createHookSlot("id", { type, value: typeof hook.__ === "string" ? hook.__ : "" });
      }
      return createHookSlot("volatile", { type });
    });
  }
}

let __runtime = null;
let __globalQueue = Promise.resolve();

export class ${ARTIFACT_FACET_EXPORT_NAME} extends DurableObject {
  fetch(request) {
    const run = __globalQueue.then(() => this.renderArtifact(request));
    __globalQueue = run.catch(() => {});
    return run;
  }

  async renderArtifact(request) {
    try {
      const input = await request.json().catch(() => ({}));
      const state = this.ctx.storage.kv.get("hookState") || [];
      __runtime = createRuntime(state);
      if (input.event) await __runtime.dispatch(input.event);
      const tree = await __runtime.render();
      this.ctx.storage.kv.put("hookState", __runtime.getState());
      this.ctx.storage.kv.put("updatedAt", Date.now());
      return json({ tree });
    } catch (err) {
      return json({ error: err instanceof Error ? err.name + ": " + err.message : String(err) }, 400);
    }
  }
}
`;
}
