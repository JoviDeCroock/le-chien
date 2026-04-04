import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";

const PILLARS = [
  {
    label: "Persistent memory",
    description: "Save useful facts once and let the assistant carry them forward.",
  },
  {
    label: "Open-model choice",
    description: "Switch between fast, balanced, and reasoning modes without leaving the thread.",
  },
  {
    label: "Visible tools",
    description: "Web search, web access, calculations, and image generation stay inspectable.",
  },
];

const DIFFERENTIATORS = [
  {
    title: "It keeps context alive",
    description:
      "The assistant can save durable memory, so preferences and recurring context do not disappear every session.",
  },
  {
    title: "It stays fast under real work",
    description:
      "Streaming responses, curated model modes, and clean controls keep the product useful for daily use instead of occasional demos.",
  },
  {
    title: "It stays clear instead of cluttered",
    description:
      "Tool calls are visible, pricing is easy to understand, and the interface stays focused on the conversation.",
  },
];

const COMPARISON_ROWS = [
  {
    label: "Context",
    other: "Forgets you too quickly",
    chien: "Carries useful details forward",
  },
  {
    label: "Model choice",
    other: "Too hidden or too fiddly",
    chien: "Simple modes for speed, balance, and depth",
  },
  {
    label: "Actions",
    other: "Hard to trust",
    chien: "Inspectable tool calls directly in chat",
  },
  {
    label: "Feel",
    other: "Busy or overbuilt",
    chien: "Focused, calm, and pleasant to use",
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Choose the mode that fits the moment",
    description:
      "Use Flash for quick answers, Scout for clean instruction following, or step up to premium modes when the work gets harder.",
    detail: "Free users can try every mode. Premium usage is what gates the upgrade.",
  },
  {
    step: "02",
    title: "Let the conversation accumulate context",
    description:
      "Memory turns repeated setup into a one-time decision, which makes the assistant more useful the longer you keep working.",
    detail: "Preferences, role, tone, ongoing projects, and recurring facts can persist.",
  },
  {
    step: "03",
    title: "Use tools without losing the thread",
    description:
      "Run web searches, fetch pages, generate images, or calculate inline while keeping each action visible and reviewable.",
    detail: "You can see what the assistant used instead of trusting invisible orchestration.",
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

function SectionLabel({ children }: { children: ComponentChildren }) {
  return (
    <div class="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
      {children}
    </div>
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
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
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
        <section class="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div class="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:gap-12">
            <div>
              <div
                class="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 animate-fade-in"
                style={{ animationDelay: "40ms" }}
              >
                <span class="h-2 w-2 rounded-full bg-violet-500" />
                Fast chat with memory when you want it
              </div>
              <h1
                class="animate-fade-in text-4xl font-bold tracking-tight text-white text-balance sm:text-6xl"
                style={{ letterSpacing: "-0.04em", lineHeight: "0.96", animationDelay: "90ms" }}
              >
                A chat app you actually want to keep open.
              </h1>
              <p
                class="mt-6 max-w-2xl animate-fade-in text-base leading-8 text-neutral-400 sm:text-lg"
                style={{ animationDelay: "140ms" }}
              >
                le chien is a clean AI chat app with fast replies, model modes that make sense, and
                memory that saves you from repeating yourself.
              </p>
              <div
                class="mt-8 flex animate-fade-in flex-col gap-3 sm:flex-row"
                style={{ animationDelay: "190ms" }}
              >
                <a
                  href="/auth"
                  class="rounded-lg bg-violet-600 px-6 py-3.5 text-center text-sm font-medium text-white transition-all duration-150 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] active:scale-[0.98]"
                >
                  Get started for free
                </a>
                <a
                  href="#pricing"
                  class="rounded-lg border border-neutral-800 px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:border-neutral-600 hover:bg-neutral-900"
                >
                  See pricing
                </a>
              </div>
              <div
                class="mt-10 grid animate-fade-in gap-3 sm:grid-cols-3"
                style={{ animationDelay: "240ms" }}
              >
                <div class="rounded-xl border border-neutral-900 bg-neutral-900/70 p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">Speed</div>
                  <div class="mt-2 text-lg font-semibold text-white">Fast replies</div>
                  <p class="mt-1 text-sm leading-6 text-neutral-400">
                    Built to feel useful in the middle of a normal workday.
                  </p>
                </div>
                <div class="rounded-xl border border-neutral-900 bg-neutral-900/70 p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">Pricing</div>
                  <div class="mt-2 text-lg font-semibold text-white">$0</div>
                  <p class="mt-1 text-sm leading-6 text-neutral-400">
                    Free to start, with a simple upgrade when you want more.
                  </p>
                </div>
                <div class="rounded-xl border border-neutral-900 bg-neutral-900/70 p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">Memory</div>
                  <div class="mt-2 text-lg font-semibold text-white">Built in</div>
                  <p class="mt-1 text-sm leading-6 text-neutral-400">
                    Preferences and recurring context can stick around instead of resetting.
                  </p>
                </div>
              </div>
            </div>

            <div
              class="animate-fade-in rounded-2xl border border-neutral-800 bg-neutral-900"
              style={{ animationDelay: "140ms" }}
            >
              <div class="border-b border-neutral-800 px-5 py-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">
                      Inside the app
                    </div>
                    <div class="mt-1 text-lg font-semibold text-white">
                      A chat surface that stays out of your way
                    </div>
                  </div>
                  <div class="rounded-full border border-violet-600/30 bg-violet-600/10 px-3 py-1 text-xs font-medium text-violet-300">
                    Streaming
                  </div>
                </div>
              </div>

              <div class="space-y-5 p-5">
                <div class="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">
                      Model modes
                    </div>
                    <div class="text-xs text-neutral-400">Switch per thread</div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2 text-sm">
                    {["Flash", "Scout", "Lite", "Pro", "Thinker", "Converser"].map((mode) => (
                      <span
                        key={mode}
                        class={`rounded-full border px-3 py-1 ${
                          mode === "Pro"
                            ? "border-violet-600/40 bg-violet-600/10 text-violet-300"
                            : "border-neutral-800 bg-neutral-900 text-neutral-400"
                        }`}
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>

                <div class="space-y-3">
                  <div class="max-w-[85%] rounded-2xl rounded-bl-md border border-neutral-800 bg-neutral-950 px-4 py-3">
                    <p class="text-sm leading-6 text-neutral-300">
                      Draft a product update for the team. Keep the tone direct and mention that I
                      prefer concise technical notes.
                    </p>
                  </div>

                  <div class="rounded-2xl rounded-tl-md border border-neutral-800 bg-neutral-950 px-4 py-4">
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">
                      Assistant response
                    </div>
                    <p class="mt-2 text-sm leading-6 text-neutral-300">
                      Working from your saved preference for concise technical updates. I&apos;ll
                      keep the note short, call out the release impact, and skip marketing phrasing.
                    </p>
                    <div class="mt-4 space-y-2">
                      <div class="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
                        <div class="text-xs font-medium text-white">Tool call</div>
                        <div class="mt-1 text-xs leading-5 text-neutral-400">
                          Web search enabled for current release context
                        </div>
                      </div>
                      <div class="rounded-lg border border-violet-600/30 bg-violet-600/10 px-3 py-2">
                        <div class="text-xs font-medium text-violet-300">Memory used</div>
                        <div class="mt-1 text-xs leading-5 text-neutral-300">
                          Preferred tone: concise, technical, no fluff
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-3">
                  <div class="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">Messages</div>
                    <div class="mt-2 text-2xl font-semibold tracking-tight text-white">20/day</div>
                    <div class="mt-1 text-sm text-neutral-400">Free plan baseline</div>
                  </div>
                  <div class="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">
                      Premium use
                    </div>
                    <div class="mt-2 text-2xl font-semibold tracking-tight text-white">5/day</div>
                    <div class="mt-1 text-sm text-neutral-400">
                      Try premium models before upgrading
                    </div>
                  </div>
                  <div class="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">
                      Image gen
                    </div>
                    <div class="mt-2 text-2xl font-semibold tracking-tight text-white">5/day</div>
                    <div class="mt-1 text-sm text-neutral-400">Included on free</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="border-t border-neutral-900">
          <div class="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div class="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <SectionLabel>Why it lands</SectionLabel>
                <h2 class="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  A better everyday chat experience.
                </h2>
                <p class="mt-4 max-w-lg text-base leading-8 text-neutral-400">
                  The appeal is simple: it is fast, easy to read, easy to steer, and it gets more
                  helpful as it learns the details worth keeping.
                </p>
                <div class="mt-8 space-y-4">
                  {DIFFERENTIATORS.map((item) => (
                    <div
                      key={item.title}
                      class="rounded-xl border border-neutral-900 bg-neutral-900/70 p-4"
                    >
                      <h3 class="text-base font-semibold text-white">{item.title}</h3>
                      <p class="mt-2 text-sm leading-6 text-neutral-400">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div class="rounded-2xl border border-neutral-800 bg-neutral-900">
                <div class="border-b border-neutral-800 px-5 py-4">
                  <SectionLabel>What feels better</SectionLabel>
                  <p class="max-w-xl text-sm leading-6 text-neutral-400">
                    The point is not more complexity. It is a smoother chat app that stays useful.
                  </p>
                </div>
                <div class="divide-y divide-neutral-800">
                  {COMPARISON_ROWS.map((row) => (
                    <div
                      key={row.label}
                      class="grid gap-4 px-5 py-4 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <div class="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
                        {row.label}
                      </div>
                      <div class="text-sm leading-6 text-neutral-400">{row.other}</div>
                      <div class="text-sm leading-6 text-neutral-300">{row.chien}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="border-t border-neutral-900">
          <div class="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <SectionLabel>Workflow</SectionLabel>
            <div class="mb-10 flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 class="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Simple enough for daily use, strong enough when you need more.
              </h2>
              <p class="max-w-lg text-sm leading-6 text-neutral-400">
                Most of the value comes from making normal chat feel smoother and less repetitive.
              </p>
            </div>
            <div class="grid gap-4 lg:grid-cols-3">
              {WORKFLOW.map((item) => (
                <div
                  key={item.step}
                  class="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  <div class="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
                    Step {item.step}
                  </div>
                  <h3 class="mt-4 text-xl font-semibold tracking-tight text-white">{item.title}</h3>
                  <p class="mt-3 text-sm leading-6 text-neutral-400">{item.description}</p>
                  <div class="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm leading-6 text-neutral-300">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
            <div class="mt-6 grid gap-4 lg:grid-cols-3">
              {PILLARS.map((item) => (
                <div
                  key={item.label}
                  class="rounded-xl border border-neutral-900 bg-neutral-900/70 p-4"
                >
                  <div class="text-sm font-medium text-white">{item.label}</div>
                  <p class="mt-2 text-sm leading-6 text-neutral-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" class="border-t border-neutral-900">
          <div class="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div class="mb-10 flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <SectionLabel>Pricing</SectionLabel>
                <h2 class="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Strong free tier, obvious upgrade path.
                </h2>
              </div>
              <p class="max-w-lg text-sm leading-6 text-neutral-400">
                Pro keeps the good parts unlimited instead of turning the app into a maze of locked
                features.
              </p>
            </div>

            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
              <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
                <div class="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  Free
                </div>
                <div class="mt-3 text-4xl font-bold tracking-tight text-white">
                  $0<span class="text-base font-normal text-neutral-400">/mo</span>
                </div>
                <p class="mt-3 text-sm leading-6 text-neutral-400">
                  Enough to make the product part of your routine before paying for it.
                </p>
                <ul class="mt-6 space-y-3 text-sm text-neutral-400">
                  <PricingFeature>20 messages per day</PricingFeature>
                  <PricingFeature>5 premium model messages per day</PricingFeature>
                  <PricingFeature>5 image generations per day</PricingFeature>
                  <PricingFeature>All public model modes visible</PricingFeature>
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
                  $8<span class="text-base font-normal text-neutral-400">/mo</span>
                </div>
                <p class="mt-3 text-sm leading-6 text-neutral-400">
                  For people who want the product available all day, without quota anxiety.
                </p>
                <ul class="mt-6 space-y-3 text-sm text-neutral-400">
                  <PricingFeature>Unlimited messages</PricingFeature>
                  <PricingFeature>Unlimited premium model messages</PricingFeature>
                  <PricingFeature>Unlimited image generations</PricingFeature>
                  <PricingFeature>All public model modes</PricingFeature>
                  <PricingFeature>Priority inference feel</PricingFeature>
                </ul>
                <a
                  href="/auth"
                  class="mt-8 block rounded-lg bg-violet-600 px-4 py-3 text-center text-sm font-medium text-white transition-all duration-150 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] active:scale-[0.98]"
                >
                  Upgrade to Pro
                </a>
              </div>

              <div class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">
                  Yearly option
                </div>
                <div class="mt-3 text-3xl font-semibold tracking-tight text-white">$72</div>
                <p class="mt-2 text-sm leading-6 text-neutral-400">
                  Equivalent to $6 per month when billed yearly.
                </p>
                <div class="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <div class="text-xs uppercase tracking-[0.18em] text-neutral-400">
                    Positioning
                  </div>
                  <p class="mt-2 text-sm leading-6 text-neutral-300">
                    Cheap enough to try, clear enough to understand, and pleasant enough to keep
                    using.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="border-t border-neutral-900">
          <div class="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div class="rounded-3xl border border-neutral-800 bg-neutral-900 px-6 py-8 sm:px-8 sm:py-10">
              <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <SectionLabel>Final push</SectionLabel>
                  <h2 class="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    If you want AI chat to feel fast, clear, and personal, start here.
                  </h2>
                  <p class="mt-4 max-w-2xl text-base leading-8 text-neutral-400">
                    Start on free, get a feel for the product, and upgrade only if you want the
                    limits to disappear.
                  </p>
                </div>
                <div class="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/auth"
                    class="rounded-lg bg-violet-600 px-6 py-3.5 text-center text-sm font-medium text-white transition-all duration-150 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] active:scale-[0.98]"
                  >
                    Create account
                  </a>
                  <a
                    href="mailto:hello@lechien.ai"
                    class="rounded-lg border border-neutral-700 px-6 py-3.5 text-center text-sm font-medium text-white transition-colors hover:border-neutral-500 hover:bg-neutral-950"
                  >
                    Contact
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer class="border-t border-neutral-900 px-6 py-10">
        <div class="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span class="font-semibold tracking-tight text-white">le&nbsp;chien</span>
            <p class="mt-1">Fast chat, useful memory, and a cleaner interface.</p>
          </div>
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
