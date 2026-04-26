export type ArtifactTextNode = string | number;

export type ArtifactElementNode = {
  tag: string;
  props?: Record<string, unknown>;
  events?: Partial<Record<"click" | "input" | "change" | "submit", string>>;
  children?: ArtifactNode[];
};

export type ArtifactNode = ArtifactTextNode | ArtifactElementNode | ArtifactNode[];

export type ArtifactRenderInput = {
  code: string;
  state?: unknown[];
  event?: {
    id: string;
    type: "click" | "input" | "change" | "submit";
    value?: string;
    checked?: boolean;
  };
};

export type ArtifactRenderResult = {
  tree?: ArtifactNode;
  state?: unknown[];
  error?: string;
};

export type JavaScriptRunResult = {
  result?: string;
  logs?: string[];
  error?: string;
};

const DYNAMIC_WORKER_COMPATIBILITY_DATE = "2026-04-25";
const DYNAMIC_WORKER_MODULE = "index.js";
const MAX_DYNAMIC_WORKER_ERROR_LENGTH = 500;
const MAX_ARTIFACT_CODE_CHARS = 24_000;
const MAX_JAVASCRIPT_CODE_CHARS = 16_000;

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
): Promise<DynamicWorkerResponse<T>> {
  if (!env.LOADER) {
    throw new Error("Dynamic Worker Loader binding is not configured");
  }

  const code = {
    compatibilityDate: DYNAMIC_WORKER_COMPATIBILITY_DATE,
    mainModule: DYNAMIC_WORKER_MODULE,
    modules: {
      [DYNAMIC_WORKER_MODULE]: source,
    },
    globalOutbound: null,
  };
  const worker = cacheId ? env.LOADER.get(cacheId, () => code) : env.LOADER.load(code);

  const response = await worker.getEntrypoint().fetch("https://sandbox.local/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

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

export async function renderDynamicArtifact(
  env: Cloudflare.Env,
  input: ArtifactRenderInput,
): Promise<ArtifactRenderResult> {
  if (input.code.length > MAX_ARTIFACT_CODE_CHARS) {
    return { error: `Artifact code is too large. Limit is ${MAX_ARTIFACT_CODE_CHARS} characters.` };
  }

  const stripped = stripModuleSyntax(input.code);
  const componentName = stripped.exportName ?? findComponentName(stripped.code);
  if (!componentName) {
    return {
      error:
        "Cannot determine component name. Artifact code must end with a PascalCase function or const component.",
    };
  }

  try {
    const source = buildArtifactWorkerSource(stripped.code, componentName);
    const cacheId = await getWorkerCacheId("artifact", source);
    return await callDynamicWorker<ArtifactRenderResult>(env, source, input, cacheId);
  } catch (err) {
    return { error: formatDynamicWorkerError(err) };
  }
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
const Fragment = Symbol.for("le-chien.fragment");
const MAX_DEPTH = 30;
const MAX_NODES = 800;
const MAX_STATE_ITEMS = 50;
const MAX_STATE_JSON = 16_000;
const MAX_TEXT_LENGTH = 4_000;
const MAX_PROP_LENGTH = 1_000;
const MAX_EFFECT_PASSES = 5;
const HOOK_SLOT_KEY = "__leChienHookSlot";
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

let __runtime = null;
let h = (...args) => __runtime.h(...args);
let useState = (...args) => __runtime.useState(...args);
let useEffect = (...args) => __runtime.useEffect(...args);
let useRef = (...args) => __runtime.useRef(...args);
let useMemo = (...args) => __runtime.useMemo(...args);
let useCallback = (...args) => __runtime.useCallback(...args);
let fetch = undefined;
let WebSocket = undefined;
let XMLHttpRequest = undefined;
let EventSource = undefined;
let localStorage = undefined;
let sessionStorage = undefined;
let navigator = undefined;
let document = undefined;
let window = undefined;
let setTimeout = undefined;
let setInterval = undefined;
let clearTimeout = undefined;
let clearInterval = undefined;
let requestAnimationFrame = undefined;

${code}

const __Component = ${componentName};

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

function areJsonValuesEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
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

function createRuntime(initialState) {
  let hookIndex = 0;
  let nodeCount = 0;
  let stateChanged = false;
  let pendingEffects = [];
  const hookState = sanitizeState(initialState);
  const handlers = new Map();

  function normalizeChildren(children) {
    const flattened = [];
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false || child === true) continue;
      flattened.push(child);
    }
    return flattened;
  }

  function vnode(tag, props, ...children) {
    return { tag, props: props || {}, children: normalizeChildren(children) };
  }

  function useState(initial) {
    const index = hookIndex++;
    if (!isHookSlot(hookState[index], "state")) {
      const initialValue =
        hookState[index] === undefined ? (typeof initial === "function" ? initial() : initial) : hookState[index];
      hookState[index] = createHookSlot("state", { value: sanitizeStateValue(initialValue) });
    }
    const setState = (next) => {
      const slot = hookState[index];
      const current = isHookSlot(slot, "state") ? slot.value : undefined;
      const nextValue = sanitizeStateValue(typeof next === "function" ? next(current) : next);
      if (!areJsonValuesEqual(current, nextValue)) {
        hookState[index] = createHookSlot("state", { value: nextValue });
        stateChanged = true;
      }
    };
    return [hookState[index].value, setState];
  }

  function useEffect(effect, deps) {
    const index = hookIndex++;
    const nextDeps = sanitizeEffectDeps(deps);
    const previous = isHookSlot(hookState[index], "effect") ? hookState[index].deps : undefined;
    const shouldRun = nextDeps === null || previous === undefined || !areJsonValuesEqual(previous, nextDeps);
    hookState[index] = createHookSlot("effect", { deps: nextDeps });
    if (shouldRun && typeof effect === "function") {
      pendingEffects.push(effect);
    }
  }

  function useRef(initial) {
    const [ref] = useState({ current: initial });
    return ref;
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

    let tag = node.tag;
    const props = isPlainObject(node.props) ? node.props : {};
    const children = Array.isArray(node.children) ? node.children : [];

    if (tag === Fragment) {
      return children
        .map((child, index) => sanitizeNode(child, path + "." + index, depth + 1))
        .filter((child) => child !== null);
    }

    if (typeof tag === "function") {
      return sanitizeNode(tag({ ...props, children }), path, depth + 1);
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
    hookIndex = 0;
    nodeCount = 0;
    pendingEffects = [];
    stateChanged = false;
    handlers.clear();
    const tree = sanitizeNode(vnode(__Component, {}));
    return tree ?? "";
  }

  async function renderWithEffects() {
    let tree = renderOnce();
    for (let pass = 0; pass < MAX_EFFECT_PASSES; pass++) {
      const effects = pendingEffects;
      if (effects.length === 0) return tree;
      pendingEffects = [];
      stateChanged = false;
      for (const effect of effects) {
        const result = effect();
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
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
    h: vnode,
    Fragment,
    useState,
    useEffect,
    useRef,
    useMemo(fn) {
      return fn();
    },
    useCallback(fn) {
      return fn;
    },
    render: renderWithEffects,
    dispatch,
    getState() {
      return sanitizeState(hookState);
    },
  };
}

export default {
  async fetch(request) {
    try {
      const input = await request.json();
      __runtime = createRuntime(input.state);
      if (input.event) await __runtime.dispatch(input.event);
      const tree = await __runtime.render();
      return json({ tree, state: __runtime.getState() });
    } catch (err) {
      return json({ error: err instanceof Error ? err.name + ": " + err.message : String(err) }, 400);
    }
  },
};
`;
}
