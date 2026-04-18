/**
 * Shared types for the artifact sandbox bridge.
 * The worker emits `DomOp` arrays; the main thread applies them to a real container.
 * Ported from dynamui (single source of truth lives here).
 */

export type NodeId = number;

// Worker pre-allocates this id; the main thread maps it to the real container element
// so we never need a createElement op for the root.
export const ROOT_NODE_ID: NodeId = 0;

export type DomOp =
  | { op: "createElement"; id: NodeId; tag: string }
  | { op: "createElementNS"; id: NodeId; ns: string; tag: string }
  | { op: "createTextNode"; id: NodeId; text: string }
  | { op: "createComment"; id: NodeId; text: string }
  | { op: "insertBefore"; parentId: NodeId; nodeId: NodeId; refId: NodeId | null }
  | { op: "removeChild"; parentId: NodeId; nodeId: NodeId }
  | { op: "setAttribute"; id: NodeId; name: string; value: string }
  | { op: "removeAttribute"; id: NodeId; name: string }
  | { op: "setProperty"; id: NodeId; name: string; value: string | number | boolean | null }
  | { op: "setTextData"; id: NodeId; text: string }
  | { op: "setStyleProperty"; id: NodeId; prop: string; value: string }
  | { op: "removeStyleProperty"; id: NodeId; prop: string }
  | { op: "setStyleCssText"; id: NodeId; value: string }
  | { op: "addEventListener"; id: NodeId; eventType: string }
  | { op: "removeEventListener"; id: NodeId; eventType: string };

export interface OpsMessage {
  type: "ops";
  ops: DomOp[];
}

export interface ReadyMessage {
  type: "ready";
  rootId: NodeId;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type WorkerToMainMessage = OpsMessage | ReadyMessage | ErrorMessage;

export type MainToWorkerMessage =
  | { type: "mount"; code: string; props: Record<string, unknown> }
  | { type: "unmount" }
  | { type: "event"; id: NodeId; eventType: string; eventData: SerializedEvent };

export interface SerializedEvent {
  type: string;
  value?: string;
  checked?: boolean;
  key?: string;
  code?: string;
  clientX?: number;
  clientY?: number;
  button?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}
