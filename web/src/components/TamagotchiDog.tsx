import type { PetMood } from "../models/tamagotchi";

type TamagotchiDogProps = {
  mood: PetMood;
  size?: number;
};

const stroke = {
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
  fill: "none",
};

function EcstaticDog() {
  return (
    <g>
      {/* Body */}
      <path d="M7 18v-4a5 5 0 0 1 10 0v4" {...stroke} />
      {/* Head */}
      <circle cx="12" cy="10" r="4" {...stroke} />
      {/* Ears up */}
      <path d="M8.5 7l-2-3" {...stroke} />
      <path d="M15.5 7l2-3" {...stroke} />
      {/* Eyes - happy squints */}
      <path d="M10 9.5c.5-.5 1-.5 1.5 0" {...stroke} stroke-width="1.5" />
      <path d="M13 9.5c.5-.5 1-.5 1.5 0" {...stroke} stroke-width="1.5" />
      {/* Tongue */}
      <path d="M12 12v1.5c0 .5-.5 1-1 1" {...stroke} />
      {/* Tail wagging */}
      <path d="M17 15c1-1 2-3 2-4" {...stroke} class="animate-wag" />
      {/* Legs */}
      <path d="M9 18v2M15 18v2" {...stroke} />
    </g>
  );
}

function HappyDog() {
  return (
    <g>
      <path d="M7 18v-4a5 5 0 0 1 10 0v4" {...stroke} />
      <circle cx="12" cy="10" r="4" {...stroke} />
      {/* Ears relaxed-up */}
      <path d="M8.5 7l-1.5-2.5" {...stroke} />
      <path d="M15.5 7l1.5-2.5" {...stroke} />
      {/* Eyes */}
      <circle cx="10.5" cy="9.5" r="0.75" fill="currentColor" />
      <circle cx="13.5" cy="9.5" r="0.75" fill="currentColor" />
      {/* Nose */}
      <ellipse cx="12" cy="11.5" rx="0.75" ry="0.5" fill="currentColor" />
      {/* Tail up */}
      <path d="M17 15c1-1 1.5-3 1-4" {...stroke} />
      <path d="M9 18v2M15 18v2" {...stroke} />
    </g>
  );
}

function ContentDog() {
  return (
    <g>
      {/* Sitting body */}
      <path d="M8 18c0-2 1-5 4-5s4 3 4 5" {...stroke} />
      <circle cx="12" cy="10" r="4" {...stroke} />
      {/* Ears neutral */}
      <path d="M8.5 7.5l-2-1.5" {...stroke} />
      <path d="M15.5 7.5l2-1.5" {...stroke} />
      {/* Eyes */}
      <circle cx="10.5" cy="9.5" r="0.75" fill="currentColor" />
      <circle cx="13.5" cy="9.5" r="0.75" fill="currentColor" />
      {/* Nose */}
      <ellipse cx="12" cy="11.5" rx="0.75" ry="0.5" fill="currentColor" />
      {/* Tail resting */}
      <path d="M16 16c1 0 2-1 2-2" {...stroke} />
      {/* Front paws */}
      <path d="M10 18v1M14 18v1" {...stroke} />
    </g>
  );
}

function BoredDog() {
  return (
    <g>
      {/* Lying down body */}
      <path d="M6 17h12" {...stroke} />
      <path d="M7 17c0-2 2-3 5-3s5 1 5 3" {...stroke} />
      {/* Head on paws */}
      <circle cx="12" cy="12" r="3.5" {...stroke} />
      {/* Ears drooped */}
      <path d="M9 9.5l-2 1" {...stroke} />
      <path d="M15 9.5l2 1" {...stroke} />
      {/* Half-closed eyes */}
      <path d="M10 12h1.5" {...stroke} stroke-width="1.5" />
      <path d="M13 12h1.5" {...stroke} stroke-width="1.5" />
      {/* Nose */}
      <ellipse cx="12" cy="13.5" rx="0.75" ry="0.5" fill="currentColor" />
      {/* Paws forward */}
      <path d="M8 17v1.5M10 17v1.5" {...stroke} />
    </g>
  );
}

function SadDog() {
  return (
    <g>
      {/* Sitting low */}
      <path d="M8 18c0-2 1-4 4-4s4 2 4 4" {...stroke} />
      <circle cx="12" cy="11" r="3.5" {...stroke} />
      {/* Ears very drooped */}
      <path d="M9 9l-2.5 2" {...stroke} />
      <path d="M15 9l2.5 2" {...stroke} />
      {/* Sad eyes */}
      <circle cx="10.5" cy="10.5" r="0.75" fill="currentColor" />
      <circle cx="13.5" cy="10.5" r="0.75" fill="currentColor" />
      {/* Sad mouth */}
      <path d="M10.5 13c.5-.5 1.5-.5 2 0" {...stroke} stroke-width="1" />
      {/* Tail down */}
      <path d="M16 17c1 1 1.5 2 1 3" {...stroke} />
    </g>
  );
}

function NeglectedDog() {
  return (
    <g>
      {/* Curled up body */}
      <ellipse cx="12" cy="16" rx="5" ry="3" {...stroke} />
      {/* Head resting */}
      <circle cx="9" cy="13" r="3" {...stroke} />
      {/* Ears flat */}
      <path d="M7 11l-2 0.5" {...stroke} />
      <path d="M11 11l1-1" {...stroke} />
      {/* Eyes closed */}
      <path d="M7.5 13c.5-.3 1-.3 1.5 0" {...stroke} stroke-width="1" />
      <path d="M9.5 13c.5-.3 1-.3 1.5 0" {...stroke} stroke-width="1" />
      {/* Nose */}
      <ellipse cx="8" cy="14.5" rx="0.5" ry="0.4" fill="currentColor" />
      {/* Tail tucked */}
      <path d="M17 15c0 1-0.5 2-1 2" {...stroke} />
    </g>
  );
}

const POSE_MAP: Record<PetMood, () => preact.JSX.Element> = {
  ecstatic: EcstaticDog,
  happy: HappyDog,
  content: ContentDog,
  bored: BoredDog,
  sad: SadDog,
  neglected: NeglectedDog,
};

export function TamagotchiDog({ mood, size = 48 }: TamagotchiDogProps) {
  const Pose = POSE_MAP[mood];
  const colorClass = mood === "ecstatic" ? "text-violet-500" : "text-neutral-400";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={`${colorClass} transition-colors duration-200`}
    >
      <style>{`
        .animate-wag {
          transform-origin: 17px 15px;
          animation: wag 400ms ease-in-out infinite alternate;
        }
        @keyframes wag {
          from { transform: rotate(-10deg); }
          to { transform: rotate(10deg); }
        }
      `}</style>
      <Pose />
    </svg>
  );
}
