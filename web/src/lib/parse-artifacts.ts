/**
 * Splits assistant message content into alternating markdown / preact-artifact segments.
 * The model emits ```preact ... ``` fences for live components; everything else flows
 * through the markdown renderer.
 *
 * During streaming the closing fence may not have arrived yet — we mark such blocks
 * `complete: false` so the caller can show a "compiling" placeholder instead of
 * mounting a half-written component.
 */

export type Segment =
  | { kind: "markdown"; text: string }
  | { kind: "preact"; code: string; complete: boolean; index: number };

const FENCE_OPEN_RE = /```preact[ \t]*\r?\n/g;

export function parseArtifacts(content: string): Segment[] {
  if (!content) return [];
  if (!content.includes("```preact")) {
    return [{ kind: "markdown", text: content }];
  }

  const segments: Segment[] = [];
  let cursor = 0;
  let artifactIndex = 0;

  FENCE_OPEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_OPEN_RE.exec(content)) !== null) {
    const fenceStart = match.index;
    const codeStart = match.index + match[0].length;

    if (fenceStart > cursor) {
      segments.push({ kind: "markdown", text: content.slice(cursor, fenceStart) });
    }

    // Closing fence is ``` on its own line. Search from codeStart.
    const closeRe = /\r?\n```/g;
    closeRe.lastIndex = codeStart;
    const closeMatch = closeRe.exec(content);

    if (closeMatch) {
      const code = content.slice(codeStart, closeMatch.index);
      segments.push({ kind: "preact", code, complete: true, index: artifactIndex++ });
      cursor = closeMatch.index + closeMatch[0].length;
      FENCE_OPEN_RE.lastIndex = cursor;
    } else {
      // No closing fence yet — still streaming.
      const code = content.slice(codeStart);
      segments.push({ kind: "preact", code, complete: false, index: artifactIndex++ });
      cursor = content.length;
      break;
    }
  }

  if (cursor < content.length) {
    segments.push({ kind: "markdown", text: content.slice(cursor) });
  }

  return segments;
}
