import { useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";

function PricingFeature({ children }: { children: string }) {
  return (
    <li class="flex items-start gap-2">
      <svg
        class="w-4 h-4 text-neutral-500 shrink-0 mt-0.5"
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

  // Redirect to chat if already authenticated
  useEffect(() => {
    if (!auth.loading.value && auth.authenticated.value) {
      route("/chat");
    }
  }, [auth.loading.value, auth.authenticated.value]);

  return (
    <div class="bg-neutral-950 min-h-screen font-sans text-neutral-300">
      {/* Nav */}
      <nav class="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span class="text-white text-base font-bold tracking-tight">le&nbsp;chien</span>
        <a
          href="/auth"
          class="text-sm text-neutral-400 hover:text-white transition-colors py-3 px-3 -mr-3"
        >
          Sign in
        </a>
      </nav>

      {/* Main content */}
      <div class="max-w-2xl mx-auto px-6 pt-20 pb-16 sm:pt-32 sm:pb-24">
        {/* Headline */}
        <h1
          class="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4 text-balance animate-fade-in"
          style={{ letterSpacing: "-0.03em", animationDelay: "50ms" }}
        >
          Open-model AI chat
          <br />
          that works for you.
        </h1>

        {/* Subheadline */}
        <p
          class="text-base sm:text-lg text-neutral-400 leading-relaxed mb-10 max-w-lg animate-fade-in"
          style={{ animationDelay: "100ms" }}
        >
          Streaming chat with persistent memory, file retrieval, and workspaces. Powered by curated
          open models.
        </p>

        {/* CTA */}
        <a
          href="/auth"
          class="inline-block bg-violet-600 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] active:scale-[0.98] text-white text-sm font-medium px-6 py-3 rounded-lg transition-all duration-150 animate-fade-in"
          style={{ animationDelay: "150ms" }}
        >
          Get started — free
        </a>
      </div>

      {/* What you get — not a feature grid, just a tight list */}
      <section class="max-w-2xl mx-auto px-6 pb-24 sm:pb-32">
        <div class="border-t border-neutral-800 pt-12">
          <h2 class="text-sm font-medium tracking-wide text-neutral-500 uppercase mb-10">
            What you get
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 sm:gap-y-6">
            {[
              [
                "Streaming chat",
                "Fast responses from curated open models. Pick a mode — Fast, Deep, Code, Creative — not a model name.",
              ],
              [
                "Persistent memory",
                "Save context across conversations. Your assistant remembers what matters.",
              ],
              false && [
                "File retrieval",
                "Upload documents, reference them in chat. Answers grounded in your data.",
              ],
              false && [
                "Workspaces",
                "Personal or shared. Everything — conversations, memory, files — scoped to the workspace.",
              ],
              [
                "Tool use",
                "Your assistant can search, retrieve, and act. Every action is inspectable.",
              ],
            ]
              .filter(Boolean)
              .map(([title, desc]: any) => (
                <div key={title}>
                  <h3 class="text-xl font-semibold text-white mb-1.5">{title}</h3>
                  <p class="text-sm text-neutral-400 leading-relaxed max-w-xs">{desc}</p>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section class="max-w-2xl mx-auto px-6 pb-24">
        <div class="border-t border-neutral-800 pt-12">
          <h2 class="text-sm font-medium tracking-wide text-neutral-500 uppercase mb-10">
            Pricing
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Free */}
            <div class="border border-neutral-800 hover:border-neutral-700 rounded-lg p-6 sm:p-8 transition-colors">
              <div class="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Free
              </div>
              <div class="text-2xl font-bold text-white mb-4 tracking-tight">
                €0<span class="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul class="space-y-2.5 text-sm text-neutral-400">
                <PricingFeature>Daily message limit</PricingFeature>
                <PricingFeature>All model modes</PricingFeature>
                <PricingFeature>Persistent memory</PricingFeature>
                <PricingFeature>1 personal workspace</PricingFeature>
              </ul>
              <a
                href="/auth"
                class="block text-center mt-6 border border-neutral-700 hover:border-neutral-500 active:scale-[0.98] text-white text-sm font-medium px-4 py-3 rounded-lg transition-all duration-150"
              >
                Start free
              </a>
            </div>

            {/* Pro */}
            <div class="border border-violet-600/40 hover:border-violet-600/60 rounded-lg p-6 sm:p-8 bg-neutral-900 transition-colors">
              <div class="text-sm font-semibold text-violet-400 uppercase tracking-wide mb-2">
                Pro
              </div>
              <div class="text-2xl font-bold text-white mb-4 tracking-tight">
                €12<span class="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul class="space-y-2.5 text-sm text-neutral-400">
                <PricingFeature>Unlimited messages</PricingFeature>
                <PricingFeature>All model modes</PricingFeature>
                <PricingFeature>File upload &amp; retrieval</PricingFeature>
                <PricingFeature>Shared workspaces</PricingFeature>
                <PricingFeature>Priority inference</PricingFeature>
              </ul>
              <a
                href="/auth"
                class="block text-center mt-6 bg-violet-600 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] active:scale-[0.98] text-white text-sm font-medium px-4 py-3 rounded-lg transition-all duration-150"
              >
                Get Pro
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="border-t border-neutral-800 py-10 px-6">
        <div class="max-w-2xl mx-auto">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span class="text-sm font-bold text-white tracking-tight">le&nbsp;chien</span>
              <p class="text-xs text-neutral-500 mt-1">AI inference &amp; data in the EU</p>
            </div>
            <div class="flex gap-6 text-xs text-neutral-500">
              <a href="/auth" class="hover:text-neutral-300 transition-colors">
                Sign in
              </a>
              <a href="mailto:hello@lechien.ai" class="hover:text-neutral-300 transition-colors">
                Contact
              </a>
            </div>
          </div>
          <div class="mt-8 pt-6 border-t border-neutral-800/60 text-xs text-neutral-600">
            &copy; {new Date().getFullYear()} le chien. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
