import { h, type ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

type ArtifactTextNode = string | number;

type ArtifactElementNode = {
  tag: string;
  props?: Record<string, unknown>;
  events?: Partial<Record<"click" | "input" | "change" | "submit", string>>;
  children?: ArtifactNode[];
};

type ArtifactNode = ArtifactTextNode | ArtifactElementNode | ArtifactNode[];

type ArtifactRenderResponse = {
  tree?: ArtifactNode;
  state?: unknown[];
  timers?: ArtifactTimer[];
  error?: string;
};

type ArtifactEventType = "click" | "input" | "change" | "submit" | "timer";

type ArtifactTimer = {
  id: string;
  intervalMs: number;
};

type ArtifactTimerHandle = {
  intervalMs: number;
  handle: number;
};

const CLIENT_ALLOWED_TAGS = new Set([
  "a",
  "article",
  "aside",
  "b",
  "blockquote",
  "button",
  "caption",
  "circle",
  "code",
  "dd",
  "div",
  "dl",
  "dt",
  "ellipse",
  "em",
  "fieldset",
  "figcaption",
  "figure",
  "form",
  "g",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "input",
  "label",
  "legend",
  "li",
  "line",
  "main",
  "ol",
  "option",
  "p",
  "path",
  "polygon",
  "polyline",
  "pre",
  "progress",
  "rect",
  "section",
  "select",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "svg",
  "table",
  "tbody",
  "td",
  "text",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const CLIENT_ALLOWED_PROPS = new Set([
  "aria-hidden",
  "aria-label",
  "aria-live",
  "alt",
  "checked",
  "class",
  "className",
  "colSpan",
  "cx",
  "cy",
  "d",
  "disabled",
  "fill",
  "fillRule",
  "height",
  "href",
  "id",
  "max",
  "maxLength",
  "min",
  "name",
  "opacity",
  "placeholder",
  "points",
  "r",
  "readOnly",
  "role",
  "rowSpan",
  "rx",
  "ry",
  "selected",
  "src",
  "step",
  "stroke",
  "strokeDasharray",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeWidth",
  "target",
  "title",
  "transform",
  "type",
  "value",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
]);

export function SandboxedArtifact({ id, code }: { id: string; code: string }) {
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [tree, setTree] = useState<ArtifactNode | null>(null);
  const artifactStateRef = useRef<unknown[]>([]);
  const requestIdRef = useRef(0);
  const timerHandlesRef = useRef<Map<string, ArtifactTimerHandle>>(new Map());
  const timerEventsInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const abortController = new AbortController();
    clearArtifactTimers();
    artifactStateRef.current = [];
    setTree(null);
    void renderArtifact({ signal: abortController.signal });

    return () => {
      abortController.abort();
      clearArtifactTimers();
      requestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, code]);

  function clearArtifactTimers() {
    for (const timer of timerHandlesRef.current.values()) {
      window.clearInterval(timer.handle);
    }
    timerHandlesRef.current.clear();
    timerEventsInFlightRef.current.clear();
  }

  function syncArtifactTimers(timers: ArtifactTimer[]) {
    const nextTimers = new Map(
      timers
        .filter((timer) => typeof timer.id === "string" && Number.isFinite(timer.intervalMs))
        .map((timer) => [timer.id, timer]),
    );

    for (const [timerId, current] of timerHandlesRef.current) {
      const next = nextTimers.get(timerId);
      if (!next || next.intervalMs !== current.intervalMs) {
        window.clearInterval(current.handle);
        timerHandlesRef.current.delete(timerId);
        timerEventsInFlightRef.current.delete(timerId);
      }
    }

    for (const timer of nextTimers.values()) {
      if (timerHandlesRef.current.has(timer.id)) continue;
      const handle = window.setInterval(() => {
        if (timerEventsInFlightRef.current.has(timer.id)) return;
        timerEventsInFlightRef.current.add(timer.id);
        void renderArtifact({ event: { id: timer.id, type: "timer" } }).finally(() => {
          timerEventsInFlightRef.current.delete(timer.id);
        });
      }, timer.intervalMs);
      timerHandlesRef.current.set(timer.id, { intervalMs: timer.intervalMs, handle });
    }
  }

  async function renderArtifact(options: {
    signal?: AbortSignal;
    event?: {
      id: string;
      type: ArtifactEventType;
      value?: string;
      checked?: boolean;
    };
  }) {
    const requestId = ++requestIdRef.current;
    const preserveExistingTree = Boolean(options.event);
    if (!preserveExistingTree) setTree(null);
    setRendering(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/artifacts/render", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: options.signal,
        body: JSON.stringify({
          code,
          state: artifactStateRef.current,
          event: options.event,
        }),
      });
      const body = (await response.json()) as ArtifactRenderResponse;
      if (!response.ok || body.error) throw new Error(body.error ?? "Artifact render failed");
      if (requestId !== requestIdRef.current) return;
      artifactStateRef.current = body.state ?? [];
      setTree(body.tree ?? "");
      syncArtifactTimers(body.timers ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (requestId === requestIdRef.current) {
        clearArtifactTimers();
        setError(err instanceof Error ? err.message : "Artifact render failed");
        if (!preserveExistingTree) setTree(null);
      }
    } finally {
      if (requestId === requestIdRef.current) setRendering(false);
    }
  }

  function dispatchArtifactEvent(type: ArtifactEventType, eventId: string, event: Event): void {
    if (type === "submit") event.preventDefault();
    const target = event.currentTarget as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | HTMLElement;
    const value = "value" in target ? String(target.value ?? "") : undefined;
    const checked = "checked" in target ? Boolean(target.checked) : undefined;
    void renderArtifact({ event: { id: eventId, type, value, checked } });
  }

  return (
    <div class="my-3 rounded-lg border border-neutral-700/40 bg-neutral-900/40 overflow-hidden">
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-neutral-700/40 bg-neutral-800/40">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-medium text-neutral-400 tracking-wide uppercase">
            Artifact
          </span>
          {rendering && tree !== null && (
            <span
              aria-label="Updating artifact"
              class="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          class="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {error && (
        <div class="px-3 py-2 text-xs text-red-400 bg-red-950/30 border-b border-red-900/30">
          Artifact error: {error}
        </div>
      )}
      <div
        aria-busy={rendering ? "true" : "false"}
        class="sandboxed-artifact-body p-3 bg-neutral-950 text-neutral-200 max-h-[480px] overflow-auto"
        style={{ display: collapsed ? "none" : "block" }}
      >
        {rendering && tree === null && (
          <div class="text-xs text-neutral-500 flex items-center gap-2">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Rendering artifact…
          </div>
        )}
        {tree !== null && renderArtifactNode(tree, dispatchArtifactEvent)}
      </div>
    </div>
  );
}

function renderArtifactNode(
  node: ArtifactNode,
  onEvent: (type: ArtifactEventType, eventId: string, event: Event) => void,
): ComponentChildren {
  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <FragmentWrapper key={index}>{renderArtifactNode(child, onEvent)}</FragmentWrapper>
    ));
  }
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return null;

  const tag = String(node.tag).toLowerCase();
  if (!CLIENT_ALLOWED_TAGS.has(tag)) return null;

  const props = sanitizeClientProps(node.props);
  if (node.events?.click) {
    props.onClick = (event: Event) => onEvent("click", node.events!.click!, event);
  }
  if (node.events?.input) {
    props.onInput = (event: Event) => onEvent("input", node.events!.input!, event);
  }
  if (node.events?.change) {
    props.onChange = (event: Event) => onEvent("change", node.events!.change!, event);
  }
  if (node.events?.submit) {
    props.onSubmit = (event: Event) => onEvent("submit", node.events!.submit!, event);
  }

  const children = (node.children ?? []).map((child, index) => (
    <FragmentWrapper key={index}>{renderArtifactNode(child, onEvent)}</FragmentWrapper>
  ));
  return h(tag, props, children);
}

function FragmentWrapper({ children }: { children: ComponentChildren }) {
  return <>{children}</>;
}

function sanitizeClientProps(props: Record<string, unknown> | undefined) {
  const out: Record<string, unknown> = {};
  if (!props) return out;

  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on") || key === "dangerouslySetInnerHTML") continue;
    if (key === "style") {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out.style = value;
      }
      continue;
    }
    if (!CLIENT_ALLOWED_PROPS.has(key) && !key.startsWith("aria-")) continue;
    if ((key === "href" || key === "src") && !isSafeClientUrl(value)) continue;
    if (key === "target" && value !== "_blank" && value !== "_self") continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key === "className" ? "class" : key] = value;
    }
  }

  if (out.target === "_blank") out.rel = "noreferrer noopener";
  return out;
}

function isSafeClientUrl(value: unknown) {
  if (typeof value !== "string") return false;
  if (value.startsWith("#") || value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}
