const EU_FLAG = (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden="true">
    <rect width="20" height="14" rx="2" fill="#003399" />
    <g transform="translate(10, 7)">
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const cx = Math.cos(angle) * 5;
        const cy = Math.sin(angle) * 5;
        return (
          <polygon
            key={i}
            points="0,-0.8 0.2,-0.25 0.76,-0.25 0.32,0.1 0.48,0.65 0,-0.05 -0.48,0.65 -0.32,0.1 -0.76,-0.25 -0.2,-0.25"
            fill="#FFCC00"
            transform={`translate(${cx}, ${cy})`}
          />
        );
      })}
    </g>
  </svg>
);

function TrustSignal({ label }: { label: string }) {
  return (
    <span class="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-neutral-400 uppercase">
      <span class="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
      {label}
    </span>
  );
}

export function Landing() {
  return (
    <div class="bg-neutral-950 min-h-screen font-sans text-neutral-300">
      {/* Nav */}
      <nav class="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span class="text-white text-base font-bold tracking-tight">le&nbsp;chien</span>
        <a href="/auth" class="text-sm text-neutral-400 hover:text-white transition-colors">
          Sign in
        </a>
      </nav>

      {/* Main content */}
      <div class="max-w-2xl mx-auto px-6 pt-24 pb-16 sm:pt-32 sm:pb-24">
        {/* Sovereignty badge */}
        <div class="flex items-center gap-2 mb-6">
          {EU_FLAG}
          <span class="text-xs font-medium tracking-wide text-neutral-400 uppercase">
            AI inference &amp; data stored in the EU
          </span>
        </div>

        {/* Headline */}
        <h1
          class="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4"
          style={{ letterSpacing: "-0.03em" }}
        >
          Your AI conversations
          <br />
          stay in Europe.
        </h1>

        {/* Subheadline */}
        <p class="text-base sm:text-lg text-neutral-400 leading-relaxed mb-10 max-w-lg">
          Open-model AI chat with persistent memory, file retrieval, and workspaces. Runs on
          European infrastructure. No data leaves the EU.
        </p>

        {/* CTA */}
        <a
          href="/auth"
          class="inline-block bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-6 py-3 rounded-lg transition-colors"
        >
          Get started — free
        </a>

        {/* Trust signals */}
        <div class="flex flex-wrap gap-x-6 gap-y-2 mt-8">
          <TrustSignal label="EU-hosted inference" />
          <TrustSignal label="Open models" />
          <TrustSignal label="End-to-end encrypted" />
        </div>
      </div>

      {/* What you get — not a feature grid, just a tight list */}
      <section class="max-w-2xl mx-auto px-6 pb-20">
        <div class="border-t border-neutral-800 pt-12">
          <h2 class="text-xs font-medium tracking-wide text-neutral-500 uppercase mb-8">
            What you get
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
            {[
              [
                "Streaming chat",
                "Fast responses from curated open models. Pick a mode — Fast, Deep, Code, Creative — not a model name.",
              ],
              [
                "Persistent memory",
                "Save context across conversations. Your assistant remembers what matters.",
              ],
              [
                "File retrieval",
                "Upload documents, reference them in chat. Answers grounded in your data.",
              ],
              [
                "Workspaces",
                "Personal or shared. Everything — conversations, memory, files — scoped to the workspace.",
              ],
              [
                "Tool use",
                "Your assistant can search, retrieve, and act. Every action is inspectable.",
              ],
              [
                "Sovereignty",
                "AI inference runs in EU Cloudflare regions. Conversations stored in EU D1 databases. No US data transfer.",
              ],
            ].map(([title, desc]) => (
              <div key={title}>
                <h3 class="text-base font-semibold text-white mb-1">{title}</h3>
                <p class="text-sm text-neutral-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section class="max-w-2xl mx-auto px-6 pb-24">
        <div class="border-t border-neutral-800 pt-12">
          <h2 class="text-xs font-medium tracking-wide text-neutral-500 uppercase mb-8">Pricing</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div class="border border-neutral-800 rounded-lg p-6">
              <div class="text-sm font-medium text-white mb-1">Free</div>
              <div class="text-2xl font-bold text-white mb-3">
                €0<span class="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul class="space-y-2 text-sm text-neutral-400">
                <li>Daily message limit</li>
                <li>All model modes</li>
                <li>Persistent memory</li>
                <li>1 personal workspace</li>
              </ul>
              <a
                href="/auth"
                class="block text-center mt-6 border border-neutral-700 hover:border-neutral-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                Start free
              </a>
            </div>

            {/* Pro */}
            <div class="border border-violet-600/40 rounded-lg p-6 relative">
              <div class="absolute -top-2.5 left-4 bg-violet-600 text-white text-xs font-medium px-2 py-0.5 rounded">
                Pro
              </div>
              <div class="text-sm font-medium text-white mb-1">Pro</div>
              <div class="text-2xl font-bold text-white mb-3">
                €12<span class="text-sm font-normal text-neutral-500">/mo</span>
              </div>
              <ul class="space-y-2 text-sm text-neutral-400">
                <li>Unlimited messages</li>
                <li>All model modes</li>
                <li>File upload &amp; retrieval</li>
                <li>Shared workspaces</li>
                <li>Priority inference</li>
              </ul>
              <a
                href="/auth"
                class="block text-center mt-6 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                Get Pro
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="border-t border-neutral-800 py-8 px-6">
        <div class="max-w-2xl mx-auto flex items-center justify-between text-xs text-neutral-500">
          <span>le chien</span>
          <span>AI inference &amp; data in the EU</span>
        </div>
      </footer>
    </div>
  );
}
