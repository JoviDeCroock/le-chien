import { ContentContainer } from "./ui/Layout";
import { AlertTriangleIcon } from "./ui/Icons";

/** Inline error banner — slides in below messages. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div class="shrink-0 bg-red-950/40 border-t border-red-900/30">
      <ContentContainer class="py-2.5 flex items-center gap-2">
        <AlertTriangleIcon size={16} class="text-red-400 shrink-0" />
        <span class="text-red-300 text-xs">{message}</span>
      </ContentContainer>
    </div>
  );
}
