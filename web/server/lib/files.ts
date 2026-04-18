export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/html",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Browsers sometimes drop blank or unrecognised MIME types for plain-text
 * extensions. Fall back to the extension when that happens.
 */
export function normalizeMimeType(providedType: string, filename: string): string {
  if (providedType && providedType !== "application/octet-stream") return providedType;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "md":
      return "text/markdown";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    case "pdf":
      return "application/pdf";
    case "html":
    case "htm":
      return "text/html";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return providedType || "application/octet-stream";
  }
}
