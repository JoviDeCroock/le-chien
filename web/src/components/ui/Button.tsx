import type { JSX } from "preact";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon" | "danger-icon";

type ButtonProps = JSX.IntrinsicElements["button"] & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white rounded-lg font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-violet-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 outline-none disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white active:scale-[0.98] rounded-lg transition-all duration-150 focus-visible:ring-2 focus-visible:ring-violet-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 outline-none disabled:opacity-50",
  ghost:
    "text-neutral-300 hover:text-white active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-violet-600/50 outline-none disabled:opacity-50",
  icon: "p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 active:scale-[0.95] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-violet-600/50 outline-none cursor-pointer",
  "danger-icon":
    "p-1.5 text-neutral-400 hover:text-red-400 active:scale-[0.95] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-violet-600/50 outline-none cursor-pointer",
};

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-2 text-xs sm:text-sm",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  class: className,
  children,
  ...props
}: ButtonProps) {
  const isIconVariant = variant === "icon" || variant === "danger-icon";
  const sizeClass = isIconVariant ? "" : sizeClasses[size];

  return (
    <button class={`${variantClasses[variant]} ${sizeClass} ${className ?? ""}`.trim()} {...props}>
      {children}
    </button>
  );
}
