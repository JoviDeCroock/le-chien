import { Button } from "./ui/Button";
import { AlertTriangleIcon } from "./ui/Icons";
import { ContentContainer } from "./ui/Layout";

export function UpgradeBanner({
  message,
  onUpgrade,
  loading,
}: {
  message: string;
  onUpgrade: () => void;
  loading: boolean;
}) {
  return (
    <div class="shrink-0 border-t border-amber-950/70 bg-amber-950/30">
      <ContentContainer class="py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3 min-w-0">
          <AlertTriangleIcon size={16} class="text-amber-400 shrink-0 mt-0.5" />
          <div class="min-w-0">
            <p class="text-xs font-medium tracking-[0.02em] text-amber-300">
              Free plan limit reached
            </p>
            <p class="text-sm text-neutral-300">{message}</p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={onUpgrade} disabled={loading}>
          {loading ? "Redirecting..." : "Upgrade to Pro"}
        </Button>
      </ContentContainer>
    </div>
  );
}
