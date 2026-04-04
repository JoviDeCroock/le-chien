import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";

const COMPARISON_ROWS = [
  {
    label: "Context",
    other: "Forgets you every session",
    chien: "Persistent memory carries details forward",
  },
  {
    label: "Models",
    other: "One model, take it or leave it",
    chien: "Six modes — pick speed, balance, or depth per thread",
  },
  {
    label: "Tools",
    other: "Invisible orchestration",
    chien: "Every tool call visible and reviewable",
  },
  {
    label: "Feel",
    other: "Busy, overbuilt",
    chien: "Focused on the conversation",
  },
];

function PricingFeature({ children }: { children: ComponentChildren }) {
  return (
    <li class="flex items-start gap-2">
      <svg
        class="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 8.5L6.5 12L13 4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>{children}</span>
    </li>
  );
}

export function Landing() {
  const { route } = useLocation();
  const auth = useModel(AuthModel);

  useEffect(() => {
    auth.checkSession();
  }, []);

  useEffect(() => {
    if (!auth.loading.value && auth.authenticated.value) {
      route("/chat");
    }
  }, [auth.loading.value, auth.authenticated.value]);

  return (
    <div class="min-h-screen bg-neutral-950 font-sans text-neutral-300">
      <header class="border-b border-neutral-900">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div class="flex items-center gap-3">
            <span class="text-base font-bold tracking-tight text-white">le&nbsp;chien</span>
            <span class="hidden text-xs uppercase tracking-[0.18em] text-neutral-400 sm:inline">
              AI chat, done cleanly
            </span>
          </div>
          <div class="flex items-center gap-3">
            <a
              href="/auth"
              class="px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white"
            >
              Sign in
            </a>
            <a
              href="/auth"
              class="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] active:scale-[0.98]"
            >
              Start free
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section class="mx-auto max-w-5xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
          <div class="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:gap-16">
            <div>
              <h1
                class="animate-fade-in text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl"
                style={{ letterSpacing: "-0.03em", lineHeight: "1.05" }}
              >
                Fast AI chat with memory that sticks.
              </h1>
              <p
                class="mt-6 max-w-lg animate-fade-in text-base leading-7 text-neutral-400"
                style={{ animationDelay: "80ms" }}
              >
                Six model modes, persistent memory, visible tool calls. Free to start, $8/mo when
                you want unlimited.
              </p>
              <div class="mt-8 flex animate-fade-in gap-3" style={{ animationDelay: "140ms" }}>
                <a
                  href="/auth"
                  class="rounded-lg bg-violet-600 px-5 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] active:scale-[0.98]"
                >
                  Get started
                </a>
                <a
                  href="#pricing"
                  class="rounded-lg border border-neutral-800 px-5 py-3 text-sm font-medium text-white transition-colors hover:border-neutral-600 hover:bg-neutral-900"
                >
                  Pricing
                </a>
              </div>
            </div>

            {/* App preview */}
            <div
              class="animate-fade-in overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900"
              style={{ animationDelay: "100ms" }}
            >
              <div class="flex items-center justify-between border-b border-neutral-800 px-5 py-3.5">
                <div class="text-sm font-medium text-white">New thread</div>
                <div class="flex items-center gap-2">
                  {["Flash", "Scout", "Pro"].map((mode) => (
                    <span
                      key={mode}
                      class={`rounded-full border px-2.5 py-0.5 text-xs ${
                        mode === "Pro"
                          ? "border-violet-600/40 bg-violet-600/10 text-violet-300"
                          : "border-neutral-800 text-neutral-500"
                      }`}
                    >
                      {mode}
                    </span>
                  ))}
                  <span class="text-xs text-neutral-600">+3</span>
                </div>
              </div>

              <div class="space-y-3 p-4">
                <div class="max-w-[85%] rounded-2xl rounded-bl-md border border-neutral-800 bg-neutral-950 px-4 py-3">
                  <p class="text-sm leading-6 text-neutral-300">
                    Draft a product update. Keep it concise and technical.
                  </p>
                </div>

                <div class="rounded-2xl rounded-tl-md border border-neutral-800 bg-neutral-950 px-4 py-3.5">
                  <p class="text-sm leading-6 text-neutral-300">
                    Using your saved preference for concise updates. Skipping marketing phrasing.
                  </p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <span class="rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400">
                      Web search
                    </span>
                    <span class="rounded-md border border-violet-600/30 bg-violet-600/10 px-2.5 py-1 text-xs text-violet-300">
                      Memory: concise, no fluff
                    </span>
                  </div>
                </div>

                <div class="rounded-2xl rounded-tl-md border border-neutral-800 bg-neutral-950 px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <div class="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500 animate-pulse" />
                    <p class="text-sm text-neutral-500">Drafting update...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section class="border-t border-neutral-900">
          <div class="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <h2 class="mb-8 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              What feels different.
            </h2>
            <div class="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
              <div class="hidden grid-cols-[100px_1fr_1fr] border-b border-neutral-800 px-5 py-3 sm:grid">
                <div />
                <div class="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Others
                </div>
                <div class="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                  le chien
                </div>
              </div>
              <div class="divide-y divide-neutral-800">
                {COMPARISON_ROWS.map((row) => (
                  <div
                    key={row.label}
                    class="grid gap-2 px-5 py-4 sm:grid-cols-[100px_1fr_1fr] sm:gap-4"
                  >
                    <div class="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                      {row.label}
                    </div>
                    <div class="text-sm leading-6 text-neutral-500">{row.other}</div>
                    <div class="text-sm leading-6 text-neutral-200">{row.chien}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" class="border-t border-neutral-900">
          <div class="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <h2 class="mb-8 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Simple pricing.
            </h2>

            <div class="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
              <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
                <div class="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  Free
                </div>
                <div class="mt-3 text-4xl font-bold tracking-tight text-white">
                  $0<span class="text-base font-normal text-neutral-500">/mo</span>
                </div>
                <ul class="mt-6 space-y-3 text-sm text-neutral-400">
                  <PricingFeature>20 messages per day</PricingFeature>
                  <PricingFeature>5 premium messages per day</PricingFeature>
                  <PricingFeature>5 image generations per day</PricingFeature>
                  <PricingFeature>All model modes</PricingFeature>
                  <PricingFeature>Persistent memory</PricingFeature>
                </ul>
                <a
                  href="/auth"
                  class="mt-8 block rounded-lg border border-neutral-700 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:border-neutral-500 hover:bg-neutral-950"
                >
                  Start free
                </a>
              </div>

              <div class="rounded-2xl border border-violet-600/35 bg-neutral-900 p-6 sm:p-8">
                <div class="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
                  Pro
                </div>
                <div class="mt-3 text-4xl font-bold tracking-tight text-white">
                  $8<span class="text-base font-normal text-neutral-500">/mo</span>
                </div>
                <ul class="mt-6 space-y-3 text-sm text-neutral-400">
                  <PricingFeature>Unlimited messages</PricingFeature>
                  <PricingFeature>Unlimited premium messages</PricingFeature>
                  <PricingFeature>Unlimited image generations</PricingFeature>
                  <PricingFeature>All model modes</PricingFeature>
                  <PricingFeature>Priority inference</PricingFeature>
                </ul>
                <a
                  href="/auth"
                  class="mt-8 block rounded-lg bg-violet-600 px-4 py-3 text-center text-sm font-medium text-white transition-all duration-150 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] active:scale-[0.98]"
                >
                  Upgrade to Pro
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer class="border-t border-neutral-900 px-6 py-8">
        <div class="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span class="font-medium tracking-tight text-neutral-400">le&nbsp;chien</span>
          <div class="flex gap-5">
            <a href="/auth" class="transition-colors hover:text-neutral-300">
              Sign in
            </a>
            <a href="#pricing" class="transition-colors hover:text-neutral-300">
              Pricing
            </a>
            <a href="mailto:hello@lechien.ai" class="transition-colors hover:text-neutral-300">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
