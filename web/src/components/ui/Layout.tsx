import type { ComponentChildren } from "preact";

/** Full-screen dark shell — the outermost wrapper for every page. */
export function PageShell({
  children,
  class: className,
}: {
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <div class={`h-screen bg-neutral-950 flex overflow-hidden ${className ?? ""}`.trim()}>
      {children}
    </div>
  );
}

/** Centered content column — max-w-3xl for chat, max-w-md for forms. */
export function ContentContainer({
  children,
  width = "chat",
  class: className,
}: {
  children: ComponentChildren;
  width?: "chat" | "form";
  class?: string;
}) {
  const maxW = width === "form" ? "max-w-md" : "max-w-3xl";
  return <div class={`${maxW} mx-auto px-4 ${className ?? ""}`.trim()}>{children}</div>;
}

/** Neutral-900 surface card with border — used for forms, panels, etc. */
export function Card({
  children,
  class: className,
}: {
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <div
      class={`bg-neutral-900 border border-neutral-800 rounded-xl p-6 ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}

/** Full-screen centered loader with pulsing dot. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div class="h-screen bg-neutral-950 flex items-center justify-center">
      <div class="flex items-center gap-3">
        <div class="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
        <span class="text-neutral-400 text-sm tracking-wide">{label}</span>
      </div>
    </div>
  );
}

/** Three pulsing dots — used as streaming/typing indicator. */
export function StreamingDots() {
  return (
    <div class="flex items-center gap-1 py-1 px-1">
      <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-[pulse_1.4s_ease-in-out_infinite]" />
      <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
      <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
    </div>
  );
}

/** Section divider bar — shrink-0 with bottom border. */
export function BarSection({
  children,
  border = "bottom",
  class: className,
}: {
  children: ComponentChildren;
  border?: "bottom" | "top" | "both";
  class?: string;
}) {
  const borders = {
    bottom: "border-b border-neutral-800/60",
    top: "border-t border-neutral-800/60",
    both: "border-y border-neutral-800/60",
  };
  return (
    <div class={`shrink-0 ${borders[border]} bg-neutral-950 ${className ?? ""}`.trim()}>
      {children}
    </div>
  );
}
