/** Chat empty state — logo, title, and helper text. */
export function EmptyState() {
  return (
    <div class="h-full flex flex-col items-center justify-center px-6 select-none">
      {/* Soft glow behind the logo */}
      <div class="relative mb-8">
        <div class="absolute inset-0 blur-3xl bg-violet-600/10 rounded-full scale-150" />
        <div class="relative w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          <span class="text-2xl">&#x1f436;</span>
        </div>
      </div>
      <h2 class="text-xl font-semibold text-white mb-2 tracking-tight">le chien</h2>
      <p class="text-sm text-neutral-400 max-w-xs text-center leading-relaxed">
        Pick a model above and start chatting. All models run on Cloudflare Workers AI.
      </p>
    </div>
  );
}
