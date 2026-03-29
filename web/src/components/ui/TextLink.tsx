import type { JSX } from "preact";

type TextLinkProps = {
  class?: string;
} & (
  | ({ as?: "button" } & JSX.IntrinsicElements["button"])
  | ({ as: "a" } & JSX.IntrinsicElements["a"])
);

/** Ghost text link/button — neutral-500 with white hover. Used for "Sign out", "Sign in", etc. */
export function TextLink({ as, class: className, ...props }: TextLinkProps) {
  const cls = `text-xs text-neutral-500 hover:text-white transition-colors ${className ?? ""}`.trim();

  if (as === "a") {
    return <a class={cls} {...(props as JSX.IntrinsicElements["a"])} />;
  }
  return <button class={cls} {...(props as JSX.IntrinsicElements["button"])} />;
}
