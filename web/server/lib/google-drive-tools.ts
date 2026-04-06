import { tool } from "ai";
import { z } from "zod";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

type GoogleDriveToolOptions = {
  /** Returns a valid access token, handling refresh. Null if not connected. */
  getAccessToken: () => Promise<string | null>;
};

async function driveRequest(accessToken: string, path: string, params?: URLSearchParams) {
  const url = params ? `${DRIVE_API}${path}?${params}` : `${DRIVE_API}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }
  return res.json();
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  owners?: { displayName: string; emailAddress: string }[];
};

type DriveListResponse = {
  files: DriveFile[];
  nextPageToken?: string;
};

export function createGoogleDriveTools(options: GoogleDriveToolOptions) {
  return {
    google_drive_search: tool({
      description:
        "Search the user's Google Drive for files matching a query. Use this when the user asks about their files, documents, or wants to find something in their Drive.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Search query. Supports Google Drive query syntax: name contains, mimeType, modifiedTime, etc. For simple searches, just use keywords.",
          ),
        maxResults: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of results to return (1-25)"),
      }),
      execute: async ({ query, maxResults }) => {
        const accessToken = await options.getAccessToken();
        if (!accessToken) {
          return {
            error: "Google Drive is not connected. Ask the user to connect it in Settings.",
          };
        }

        try {
          // If the query looks like plain keywords, wrap in fullText contains
          const driveQuery =
            query.includes("contains") || query.includes("=")
              ? query
              : `fullText contains '${query.replace(/'/g, "\\'")}'`;

          const params = new URLSearchParams({
            q: `${driveQuery} and trashed = false`,
            fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,owners)",
            pageSize: String(Math.min(maxResults, 25)),
            orderBy: "modifiedTime desc",
          });

          const data = (await driveRequest(accessToken, "/files", params)) as DriveListResponse;

          return {
            query,
            results: data.files.map((f) => ({
              id: f.id,
              name: f.name,
              type: simplifyMimeType(f.mimeType),
              modified: f.modifiedTime,
              size: f.size ? formatSize(Number(f.size)) : undefined,
              url: f.webViewLink,
              owner: f.owners?.[0]?.displayName,
            })),
            count: data.files.length,
          };
        } catch (e) {
          return { query, error: e instanceof Error ? e.message : "Search failed" };
        }
      },
    }),

    google_drive_list: tool({
      description:
        "List recent files from the user's Google Drive. Use when the user wants to see what's in their Drive or browse recent files.",
      inputSchema: z.object({
        folder: z
          .string()
          .optional()
          .describe("Folder ID to list files from. Omit for root/recent files."),
        maxResults: z.number().optional().default(15).describe("Maximum number of results (1-25)"),
      }),
      execute: async ({ folder, maxResults }) => {
        const accessToken = await options.getAccessToken();
        if (!accessToken) {
          return {
            error: "Google Drive is not connected. Ask the user to connect it in Settings.",
          };
        }

        try {
          const q = folder ? `'${folder}' in parents and trashed = false` : "trashed = false";

          const params = new URLSearchParams({
            q,
            fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
            pageSize: String(Math.min(maxResults, 25)),
            orderBy: "modifiedTime desc",
          });

          const data = (await driveRequest(accessToken, "/files", params)) as DriveListResponse;

          return {
            files: data.files.map((f) => ({
              id: f.id,
              name: f.name,
              type: simplifyMimeType(f.mimeType),
              modified: f.modifiedTime,
              size: f.size ? formatSize(Number(f.size)) : undefined,
              url: f.webViewLink,
            })),
            count: data.files.length,
          };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Failed to list files" };
        }
      },
    }),

    google_drive_read: tool({
      description:
        "Read the text content of a file from Google Drive. Works with Google Docs, Sheets (as CSV), Slides (as text), and plain text files. Use when the user wants to see what's inside a specific file.",
      inputSchema: z.object({
        fileId: z.string().describe("The Google Drive file ID"),
      }),
      execute: async ({ fileId }) => {
        const accessToken = await options.getAccessToken();
        if (!accessToken) {
          return {
            error: "Google Drive is not connected. Ask the user to connect it in Settings.",
          };
        }

        try {
          // First get file metadata to determine type
          const params = new URLSearchParams({
            fields: "id,name,mimeType,size",
          });
          const meta = (await driveRequest(accessToken, `/files/${fileId}`, params)) as DriveFile;

          const content = await exportFileContent(accessToken, fileId, meta.mimeType);

          const maxLen = 15000;
          const truncated = content.length > maxLen;

          return {
            fileId,
            name: meta.name,
            type: simplifyMimeType(meta.mimeType),
            content: truncated ? content.slice(0, maxLen) + "\n...[truncated]" : content,
            length: content.length,
            truncated,
          };
        } catch (e) {
          return { fileId, error: e instanceof Error ? e.message : "Failed to read file" };
        }
      },
    }),
  };
}

async function exportFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string,
): Promise<string> {
  // Google Workspace files need to be exported
  const exportMimes: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
    "application/vnd.google-apps.drawing": "image/svg+xml",
  };

  const exportMime = exportMimes[mimeType];

  let url: string;
  if (exportMime) {
    url = `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
  } else {
    // For regular files, download directly
    url = `${DRIVE_API}/files/${fileId}?alt=media`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to read file: ${res.status}`);
  }

  return res.text();
}

function simplifyMimeType(mime: string): string {
  const map: Record<string, string> = {
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/vnd.google-apps.folder": "Folder",
    "application/vnd.google-apps.form": "Google Form",
    "application/vnd.google-apps.drawing": "Google Drawing",
    "application/pdf": "PDF",
    "text/plain": "Text",
    "text/csv": "CSV",
    "text/html": "HTML",
    "application/json": "JSON",
    "image/png": "PNG Image",
    "image/jpeg": "JPEG Image",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel Sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  };
  return map[mime] || mime;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
