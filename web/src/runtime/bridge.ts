/**
 * Main-thread bridge to the artifact sandbox worker.
 * Spawns the worker, forwards mount/unmount/event messages, and applies
 * incoming DOM ops to a real container element.
 */

import { SafeDomApplier } from "./safe-dom-main";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./safe-dom-types";

export interface BridgeCallbacks {
  onError?: (message: string) => void;
}

export class SandboxBridge {
  private worker: Worker;
  private applier: SafeDomApplier;
  private ready = false;
  private destroyed = false;
  private pendingMount: { code: string; props: Record<string, unknown> } | null = null;
  private callbacks: BridgeCallbacks;

  constructor(container: Element, callbacks: BridgeCallbacks = {}) {
    this.callbacks = callbacks;
    this.worker = new Worker(new URL("./artifact-worker.ts", import.meta.url), { type: "module" });

    this.applier = new SafeDomApplier(container, (id, eventType, eventData) => {
      const msg: MainToWorkerMessage = { type: "event", id, eventType, eventData };
      this.worker.postMessage(msg);
    });

    this.worker.addEventListener("message", (e: MessageEvent<WorkerToMainMessage>) => {
      const msg = e.data;
      if (msg.type === "ready") {
        this.ready = true;
        if (this.pendingMount) {
          this.postMount(this.pendingMount.code, this.pendingMount.props);
          this.pendingMount = null;
        }
        return;
      }
      if (msg.type === "ops") {
        this.applier.apply(msg.ops);
        return;
      }
      if (msg.type === "error") {
        this.callbacks.onError?.(msg.message);
      }
    });

    this.worker.addEventListener("error", (e) => {
      this.callbacks.onError?.(e.message || "Sandbox worker crashed");
    });
  }

  mount(code: string, props: Record<string, unknown> = {}): void {
    if (this.destroyed) return;
    if (this.ready) this.postMount(code, props);
    else this.pendingMount = { code, props };
  }

  private postMount(code: string, props: Record<string, unknown>) {
    const msg: MainToWorkerMessage = { type: "mount", code, props };
    this.worker.postMessage(msg);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      const msg: MainToWorkerMessage = { type: "unmount" };
      this.worker.postMessage(msg);
    } catch {
      // Worker may already be gone.
    }
    this.applier.destroy();
    setTimeout(() => this.worker.terminate(), 50);
  }
}
