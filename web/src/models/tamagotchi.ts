import { signal, computed, createModel } from "@preact/signals";
import { getAgentConnection } from "../lib/agent-client";

export type PetMood = "ecstatic" | "happy" | "content" | "bored" | "sad" | "neglected";

export type PetState = {
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  mood: PetMood;
  last_fed: number;
  last_played: number;
  last_petted: number;
};

export const TamagotchiModel = createModel(() => {
  const pet = signal<PetState | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const actionCooldown = signal(false);

  const mood = computed(() => pet.value?.mood ?? "content");

  function withCooldown(fn: () => Promise<void>): () => Promise<void> {
    return async () => {
      if (actionCooldown.value) return;
      actionCooldown.value = true;
      await fn();
      setTimeout(() => {
        actionCooldown.value = false;
      }, 800);
    };
  }

  const loadPet = async () => {
    loading.value = true;
    error.value = null;
    try {
      const result = await getAgentConnection().call<PetState>("getPetState");
      pet.value = result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load pet";
    } finally {
      loading.value = false;
    }
  };

  const feed = withCooldown(async () => {
    error.value = null;
    try {
      pet.value = await getAgentConnection().call<PetState>("feedPet");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to feed pet";
    }
  });

  const play = withCooldown(async () => {
    error.value = null;
    try {
      pet.value = await getAgentConnection().call<PetState>("playWithPet");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to play with pet";
    }
  });

  const petDog = withCooldown(async () => {
    error.value = null;
    try {
      pet.value = await getAgentConnection().call<PetState>("petTheDog");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to pet dog";
    }
  });

  const rename = async (name: string) => {
    error.value = null;
    try {
      pet.value = await getAgentConnection().call<PetState>("renamePet", [name]);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to rename pet";
    }
  };

  return {
    pet,
    loading,
    error,
    actionCooldown,
    mood,
    loadPet,
    feed,
    play,
    petDog,
    rename,
  };
});
