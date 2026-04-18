import type { JSX } from "preact";

type IconProps = JSX.SVGAttributes<SVGSVGElement> & {
  size?: number;
};

function Icon({ size = 16, class: className, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" class={className} {...props}>
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
};

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" {...stroke} />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v16m8-8H4" {...stroke} />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 18L18 6M6 6l12 12" {...stroke} />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
        {...stroke}
      />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
    </Icon>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" {...stroke} />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" {...stroke} />
      <path d="M12 19v4m-4 0h8" {...stroke} />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" {...stroke} />
      <circle cx="8.5" cy="8.5" r="1.5" {...stroke} />
      <path d="M21 15l-5-5L5 21" {...stroke} />
    </Icon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" {...stroke} />
      <path d="M2 12h20" {...stroke} />
      <path
        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        {...stroke}
      />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="8" {...stroke} />
      <path d="M21 21l-4.35-4.35" {...stroke} />
    </Icon>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 15l-6-6-6 6" {...stroke} />
    </Icon>
  );
}

export function DogIcon({ size = 16, class: className, ...props }: IconProps) {
  // Font Awesome Free v7.2.0 — CC BY 4.0 (https://fontawesome.com/license/free)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 640 640"
      fill="currentColor"
      class={className}
      {...props}
    >
      <path d="M64 176C80.6 176 94.2 188.6 95.8 204.7L96.1 211.3C97.8 227.4 111.4 240 128 240L307.1 240L448 300.4L448 544C448 561.7 433.7 576 416 576L384 576C366.3 576 352 561.7 352 544L352 412.7C328 425 300.8 432 272 432C243.2 432 216 425 192 412.7L192 544C192 561.7 177.7 576 160 576L128 576C110.3 576 96 561.7 96 544L96 298.4C58.7 285.2 32 249.8 32 208C32 190.3 46.3 176 64 176zM387.8 32C395.5 32 402.7 35.6 407.4 41.8L424 64L476.1 64C488.8 64 501 69.1 510 78.1L528 96L584 96C597.3 96 608 106.7 608 120L608 144C608 188.2 572.2 224 528 224L464 224L457 252L332.3 198.6L363.9 51.4C366.3 40.1 376.2 32 387.8 32zM480 108C469 108 460 117 460 128C460 139 469 148 480 148C491 148 500 139 500 128C500 117 491 108 480 108z" />
    </svg>
  );
}

export function BoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17.2 3.8a2.5 2.5 0 0 1 3 3l-8.4 8.4a2.5 2.5 0 0 1-3-3l8.4-8.4z" {...stroke} />
      <path d="M15.8 6.2l-1.4-1.4" {...stroke} />
      <path d="M9.6 12.4l-1.4-1.4" {...stroke} />
    </Icon>
  );
}

export function PawIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="8" cy="8" rx="1.5" ry="2" fill="currentColor" />
      <ellipse cx="12" cy="7" rx="1.5" ry="2" fill="currentColor" />
      <ellipse cx="16" cy="8" rx="1.5" ry="2" fill="currentColor" />
      <ellipse cx="6" cy="12" rx="1.5" ry="2" fill="currentColor" />
      <path d="M8 16c0-2 2-4 4-4s4 2 4 4a4 4 0 0 1-8 0z" fill="currentColor" />
    </Icon>
  );
}

export function BallIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" {...stroke} />
      <path d="M12 4c-2 3-2 7 0 8s2 5 0 8" {...stroke} />
      <path d="M4 12c3-2 7-2 8 0s5 2 8 0" {...stroke} />
    </Icon>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        {...stroke}
      />
    </Icon>
  );
}
