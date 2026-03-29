/** Small colored dot — for connection/presence indicators. */
export function StatusDot({
  active,
  title,
  class: className,
}: {
  active: boolean;
  title?: string;
  class?: string;
}) {
  return (
    <div
      class={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-neutral-600"} ${className ?? ""}`.trim()}
      title={title}
    />
  );
}
