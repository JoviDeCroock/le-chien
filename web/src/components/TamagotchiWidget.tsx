import type { PetState } from "../models/tamagotchi";
import { TamagotchiDog } from "./TamagotchiDog";
import { Button } from "./ui/Button";
import { BoneIcon, BallIcon, PawIcon } from "./ui/Icons";

type StatBarProps = {
  label: string;
  value: number;
};

function StatBar({ label, value }: StatBarProps) {
  return (
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-medium text-neutral-500 w-12 shrink-0 uppercase tracking-wider">
        {label}
      </span>
      <div class="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          class="h-full bg-violet-600 rounded-full transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
      <span class="text-[10px] text-neutral-500 w-5 text-right tabular-nums">{value}</span>
    </div>
  );
}

type TamagotchiWidgetProps = {
  pet: PetState;
  onFeed: () => void;
  onPlay: () => void;
  onPet: () => void;
  disabled: boolean;
};

export function TamagotchiWidget({ pet, onFeed, onPlay, onPet, disabled }: TamagotchiWidgetProps) {
  return (
    <div class="px-3 py-3 space-y-2">
      {/* Dog + name */}
      <div class="flex items-center gap-2">
        <TamagotchiDog mood={pet.mood} size={36} />
        <div class="min-w-0">
          <p class="text-xs font-medium text-neutral-300 truncate">{pet.name}</p>
          <p class="text-[10px] text-neutral-500 capitalize">{pet.mood}</p>
        </div>
      </div>

      {/* Stats */}
      <div class="space-y-1">
        <StatBar label="food" value={pet.hunger} />
        <StatBar label="happy" value={pet.happiness} />
        <StatBar label="energy" value={pet.energy} />
      </div>

      {/* Actions */}
      <div class="flex gap-1.5 pt-1">
        <Button
          variant="ghost"
          class="flex-1 flex items-center justify-center gap-1.5 !px-2 !py-2 text-[11px] font-medium rounded-md hover:bg-neutral-800"
          onClick={onFeed}
          disabled={disabled}
          title="Feed"
        >
          <BoneIcon size={14} />
          <span>Feed</span>
        </Button>
        <Button
          variant="ghost"
          class="flex-1 flex items-center justify-center gap-1.5 !px-2 !py-2 text-[11px] font-medium rounded-md hover:bg-neutral-800"
          onClick={onPlay}
          disabled={disabled}
          title="Play"
        >
          <BallIcon size={14} />
          <span>Play</span>
        </Button>
        <Button
          variant="ghost"
          class="flex-1 flex items-center justify-center gap-1.5 !px-2 !py-2 text-[11px] font-medium rounded-md hover:bg-neutral-800"
          onClick={onPet}
          disabled={disabled}
          title="Pet"
        >
          <PawIcon size={14} />
          <span>Pet</span>
        </Button>
      </div>
    </div>
  );
}
