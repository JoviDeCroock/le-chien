import { signal, createModel } from "@preact/signals";

/**
 * Per-bubble read-aloud state. Each `useModel(ReadAloudModel)` call yields a
 * fresh instance, so individual chat bubbles control their own audio without
 * sharing playback state.
 */
export const ReadAloudModel = createModel(() => {
  const status = signal<"idle" | "loading" | "playing" | "error">("idle");
  const errorMessage = signal<string | null>(null);

  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;

  function teardown() {
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  async function play(text: string) {
    if (status.value === "loading") return;
    if (status.value === "playing") {
      teardown();
      status.value = "idle";
      return;
    }

    teardown();
    status.value = "loading";
    errorMessage.value = null;

    try {
      const res = await fetch("/api/v1/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const msg = await res
          .json<{ error?: string }>()
          .then((b) => b.error ?? `HTTP ${res.status}`)
          .catch(() => `HTTP ${res.status}`);
        throw new Error(msg);
      }

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      audio = new Audio(objectUrl);
      audio.addEventListener("ended", () => {
        teardown();
        status.value = "idle";
      });
      audio.addEventListener("error", () => {
        teardown();
        status.value = "error";
        errorMessage.value = "Playback failed";
      });
      await audio.play();
      status.value = "playing";
    } catch (err) {
      teardown();
      status.value = "error";
      errorMessage.value = err instanceof Error ? err.message : "TTS request failed";
    }
  }

  function dispose() {
    teardown();
    status.value = "idle";
  }

  return { status, errorMessage, play, dispose };
});
