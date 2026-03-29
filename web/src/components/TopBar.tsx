import type { ComponentChildren } from "preact";
import { BarSection, ContentContainer } from "./ui/Layout";

/** Top navigation bar — consistent across pages. Renders left/right slots. */
export function TopBar({
  left,
  right,
}: {
  left?: ComponentChildren;
  right?: ComponentChildren;
}) {
  return (
    <BarSection>
      <ContentContainer class="h-12 flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">{left}</div>
        <div class="flex items-center gap-3">{right}</div>
      </ContentContainer>
    </BarSection>
  );
}
