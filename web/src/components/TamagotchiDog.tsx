import type { PetMood } from "../models/tamagotchi";

type TamagotchiDogProps = {
  mood: PetMood;
  size?: number;
};

const F = "#0a0a0a";

function EcstaticDog() {
  return (
    <g>
      <path
        d="M18.8 15.2c2-.6 2.7-2.7 2.1-4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        class="animate-wag"
      />
      <path
        d="M4.5 18c0-4 3-6.5 7.5-6.5s7.5 2.5 7.5 6.5v1.5c0 1-.8 1.8-1.8 1.8H6.3c-1 0-1.8-.8-1.8-1.8z"
        fill="currentColor"
      />
      <circle cx="12" cy="9" r="5.2" fill="currentColor" />
      <path d="M7.8 5c-.8-1.6-.3-3.1.7-3.5 .8 .5 1.5 2 1.5 3.3z" fill="currentColor" />
      <path d="M16.2 5c.8-1.6.3-3.1-.7-3.5-.8 .5-1.5 2-1.5 3.3z" fill="currentColor" />
      <path
        d="M8.9 8.4c.4-.7 1.3-.7 1.7 0"
        fill="none"
        stroke={F}
        stroke-width="0.9"
        stroke-linecap="round"
      />
      <path
        d="M13.4 8.4c.4-.7 1.3-.7 1.7 0"
        fill="none"
        stroke={F}
        stroke-width="0.9"
        stroke-linecap="round"
      />
      <ellipse cx="12" cy="10.2" rx="0.8" ry="0.6" fill={F} />
      <path d="M10.1 11.1c.4 1 1.1 1.6 1.9 1.6s1.5-.6 1.9-1.6z" fill={F} />
      <ellipse cx="12" cy="12.1" rx="0.55" ry="0.35" fill="#ec4899" />
    </g>
  );
}

function HappyDog() {
  return (
    <g>
      <path
        d="M19 15.2c1.6-.6 2.1-2.4 1.4-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M4.5 18c0-4 3-6.5 7.5-6.5s7.5 2.5 7.5 6.5v1.5c0 1-.8 1.8-1.8 1.8H6.3c-1 0-1.8-.8-1.8-1.8z"
        fill="currentColor"
      />
      <circle cx="12" cy="9" r="5.2" fill="currentColor" />
      {/* Floppy ears hanging down */}
      <path d="M7.2 5.6c-1.6.2-2.3 1.8-1.8 3.6 .9 .6 2 .1 2.4-1.1z" fill="currentColor" />
      <path d="M16.8 5.6c1.6.2 2.3 1.8 1.8 3.6-.9 .6-2 .1-2.4-1.1z" fill="currentColor" />
      <circle cx="9.8" cy="8.6" r="0.9" fill={F} />
      <circle cx="14.2" cy="8.6" r="0.9" fill={F} />
      <circle cx="10.05" cy="8.35" r="0.28" fill="currentColor" />
      <circle cx="14.45" cy="8.35" r="0.28" fill="currentColor" />
      <ellipse cx="12" cy="10.3" rx="0.85" ry="0.65" fill={F} />
      <path
        d="M11 11.4c.3.5.7.7 1 .7s.7-.2 1-.7"
        fill="none"
        stroke={F}
        stroke-width="0.7"
        stroke-linecap="round"
      />
    </g>
  );
}

function ContentDog() {
  return (
    <g>
      <path
        d="M19 17c1.3.2 2.1-.4 2.3-1.4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M4.5 19c0-4 3-7 7.5-7s7.5 3 7.5 7v.8c0 .8-.5 1.3-1.3 1.3H5.8c-.8 0-1.3-.5-1.3-1.3z"
        fill="currentColor"
      />
      <circle cx="12" cy="9.5" r="5.2" fill="currentColor" />
      {/* Floppy ears hanging down (slightly longer — relaxed) */}
      <path d="M7 6c-1.7.3-2.4 2.1-1.8 4 1 .5 2.1-.1 2.5-1.4z" fill="currentColor" />
      <path d="M17 6c1.7.3 2.4 2.1 1.8 4-1 .5-2.1-.1-2.5-1.4z" fill="currentColor" />
      <circle cx="9.8" cy="9.1" r="0.8" fill={F} />
      <circle cx="14.2" cy="9.1" r="0.8" fill={F} />
      <ellipse cx="12" cy="10.8" rx="0.85" ry="0.65" fill={F} />
      <path d="M11.2 12.1h1.6" fill="none" stroke={F} stroke-width="0.7" stroke-linecap="round" />
    </g>
  );
}

function BoredDog() {
  return (
    <g>
      <path
        d="M20.4 18.8c1.2.3 1.8.1 2-.3"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M2.5 19c0-2 2-3.5 4.5-3.5h10c2.5 0 4.5 1.5 4.5 3.5v.8c0 .8-.5 1.3-1.3 1.3H3.8c-.8 0-1.3-.5-1.3-1.3z"
        fill="currentColor"
      />
      <circle cx="7.5" cy="14" r="4.5" fill="currentColor" />
      {/* Both ears drooped forward symmetrically */}
      <path d="M3.7 12c-1.5.4-2 1.8-1.3 3.2 1.2-.3 2.1-1.3 2.3-2.6z" fill="currentColor" />
      <path d="M7.8 10.5c-1.1-1-2.5-.8-3.2 .5 .8 1 2 1.1 2.9 .3z" fill="currentColor" />
      <path d="M5.4 13.9h1.5" fill="none" stroke={F} stroke-width="1" stroke-linecap="round" />
      <path d="M8.4 13.9h1.5" fill="none" stroke={F} stroke-width="1" stroke-linecap="round" />
      <ellipse cx="7.4" cy="15.4" rx="0.75" ry="0.55" fill={F} />
      <path d="M6.8 16.5h1.3" fill="none" stroke={F} stroke-width="0.6" stroke-linecap="round" />
    </g>
  );
}

function SadDog() {
  return (
    <g>
      <path
        d="M17.8 17.2c1 1.3 1.2 2.8.6 4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M5 20c0-3 2.5-5.5 7-5.5s7 2.5 7 5.5v.3c0 .5-.4 1-1 1H6c-.6 0-1-.5-1-1z"
        fill="currentColor"
      />
      <circle cx="12" cy="10" r="5.2" fill="currentColor" />
      {/* Very drooped ears hanging down long */}
      <path d="M6.8 8c-1.8.5-2.6 2.6-1.8 4.4 1.2 .5 2.4-.4 2.8-1.9z" fill="currentColor" />
      <path d="M17.2 8c1.8.5 2.6 2.6 1.8 4.4-1.2 .5-2.4-.4-2.8-1.9z" fill="currentColor" />
      <circle cx="9.8" cy="10.3" r="0.8" fill={F} />
      <circle cx="14.2" cy="10.3" r="0.8" fill={F} />
      {/* Worried eyebrows — inner corners raised */}
      <path d="M8.5 9.5l1.3-.5" fill="none" stroke={F} stroke-width="0.6" stroke-linecap="round" />
      <path
        d="M15.5 9.5l-1.3-.5"
        fill="none"
        stroke={F}
        stroke-width="0.6"
        stroke-linecap="round"
      />
      <ellipse cx="12" cy="11.5" rx="0.85" ry="0.65" fill={F} />
      <path
        d="M11 13.1c.3-.5.7-.6 1-.6s.7.1 1 .6"
        fill="none"
        stroke={F}
        stroke-width="0.7"
        stroke-linecap="round"
      />
    </g>
  );
}

function NeglectedDog() {
  return (
    <g>
      <ellipse cx="13" cy="17" rx="7.5" ry="4.5" fill="currentColor" />
      <path
        d="M19 15.6c1.3.3 2 1.3 1.8 2.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
      <circle cx="7" cy="14.5" r="4.2" fill="currentColor" />
      <path d="M3.4 13c-1.3.5-1.8 1.5-1.3 2.6 1-.3 1.9-1 2.1-2.1z" fill="currentColor" />
      <path d="M8.2 11.5c.2-1.3-.4-1.8-1.3-1.5 0 1 .5 1.8 1.3 1.8z" fill="currentColor" />
      <path
        d="M5 14.3c.3-.3.8-.3 1.1 0"
        fill="none"
        stroke={F}
        stroke-width="0.7"
        stroke-linecap="round"
      />
      <path
        d="M7.5 14.3c.3-.3.8-.3 1.1 0"
        fill="none"
        stroke={F}
        stroke-width="0.7"
        stroke-linecap="round"
      />
      <ellipse cx="5.9" cy="15.7" rx="0.65" ry="0.5" fill={F} />
      <text
        x="15"
        y="10"
        font-size="3.5"
        fill="currentColor"
        opacity="0.5"
        font-family="Geist, sans-serif"
        font-weight="600"
      >
        z
      </text>
      <text
        x="17"
        y="7.5"
        font-size="2.5"
        fill="currentColor"
        opacity="0.35"
        font-family="Geist, sans-serif"
        font-weight="600"
      >
        z
      </text>
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
          transform-origin: 19px 15px;
          animation: wag 400ms ease-in-out infinite alternate;
        }
        @keyframes wag {
          from { transform: rotate(-14deg); }
          to { transform: rotate(14deg); }
        }
      `}</style>
      <Pose />
    </svg>
  );
}
